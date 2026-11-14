import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import Anthropic from "@anthropic-ai/sdk";
import { pool, type Profile } from "@workspace/db";
import pg from "pg";
import { providerForClient } from "../src/lib/matchmaking/provider";
import { AiActionError, MatchmakingService } from "../src/lib/matchmaking/service";
import { MatchmakingStore } from "../src/lib/matchmaking/store";
import { AI_BREAK_MESSAGE } from "../src/lib/matchmaking/config";
import { redactText, redactValue } from "../src/lib/redact";
import { sampleProfiles } from "../src/lib/sample-profiles";

const run = promisify(execFile);
const schema = `crossover_launch_test_${randomUUID().replaceAll("-", "")}`;
const database = new pg.Pool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${schema},public` });
try {
  await pool.query(`CREATE SCHEMA ${schema}`);
  for (const table of ["profiles", "usage_log", "sessions", "ai_requests", "swipes"]) {
    await pool.query(`CREATE TABLE ${schema}.${table} (LIKE public.${table} INCLUDING ALL)`);
  }
  // Own sequence: isolated seeding must not advance the shared profiles ID sequence.
  await pool.query(`CREATE SEQUENCE ${schema}.profiles_id_seq`);
  await pool.query(`ALTER TABLE ${schema}.profiles ALTER COLUMN id SET DEFAULT nextval('${schema}.profiles_id_seq')`);
  // New processes exercise the actual startup seeder and advisory locking.
  // Only the child search_path changes; the existing database/key are untouched.
  const seed = async () => run(process.execPath, ["--import", "tsx", "-e",
    "(async()=>{const {seedIfEmpty}=await import('./src/lib/seed.ts');const {pool}=await import('@workspace/db');await seedIfEmpty();await pool.end();})().catch(e=>{console.error(e);process.exit(1)});"],
  { cwd: process.cwd(), env: { ...process.env, PGOPTIONS: `-c search_path=${schema},public` } });
  await Promise.all([seed(), seed()]);
  let counts = (await database.query(
    "SELECT (SELECT COUNT(*)::int FROM profiles) AS people,(SELECT COUNT(*)::int FROM usage_log) AS logs",
  )).rows[0];
  assert.deepEqual(counts, { people: sampleProfiles.length, logs: 10 });
  assert.equal(sampleProfiles.length, 60);
  assert.equal((await database.query("SELECT COUNT(DISTINCT school)::int AS n FROM profiles")).rows[0].n >= 40, true);
  assert.equal((await database.query("SELECT COUNT(*)::int AS n FROM profiles WHERE is_sample=false")).rows[0].n, 0);
  assert.equal((await database.query("SELECT COUNT(*)::int AS n FROM usage_log WHERE is_sample=false")).rows[0].n, 0);
  await seed();
  counts = (await database.query("SELECT (SELECT COUNT(*)::int FROM profiles) AS people,(SELECT COUNT(*)::int FROM usage_log) AS logs")).rows[0];
  assert.deepEqual(counts, { people: sampleProfiles.length, logs: 10 });
  console.log("PASS real seeder on isolated empty tables: 60 fictional profiles, 40+ schools, 10 labeled logs, concurrent/restarted startup without duplicates");

  let sdkCalls = 0;
  const sdk = new Anthropic({
    apiKey: "phase5-invalid-key-fixture", maxRetries: 0,
    fetch: async () => {
      sdkCalls++;
      return new Response(JSON.stringify({ type: "error", error: {
        type: "authentication_error", message: "invalid x-api-key",
      } }), { status: 401, headers: { "content-type": "application/json", "request-id": "isolated-auth-test" } });
    },
  });
  const id = randomUUID();
  await database.query("INSERT INTO sessions(id,expires_at) VALUES($1,clock_timestamp()+interval '1 day')", [id]);
  const input = "I study public health at Reed College and want to build rural health education tools. I enjoy birdwatching and pottery.";
  const people = (await database.query<Profile>("SELECT * FROM profiles")).rows;
  const store = new MatchmakingStore(database);
  const service = new MatchmakingService(store, providerForClient(sdk));
  await assert.rejects(() => service.build(id, { input_text: input }, people),
    (e: unknown) => e instanceof AiActionError && e.status === 503 && e.message === AI_BREAK_MESSAGE);
  assert.equal(sdkCalls, 1);
  assert.equal((await store.session(id)).input_text, input);
  assert.equal(await new MatchmakingStore(database).remaining(id), 4);
  const log = (await database.query("SELECT * FROM usage_log WHERE session_id=$1", [id])).rows[0];
  assert.equal(log.status, "error");
  assert.equal(log.ai_output.reason, AI_BREAK_MESSAGE);
  assert(!JSON.stringify(log.ai_output).includes("api-key"));
  console.log("PASS official SDK 401 invalid-key transport: exact friendly failure, saved input, one charged attempt, no real key changed and no outbound AI call");

  // Separate processes have no shared memory and must contend on PostgreSQL.
  const visitor = randomUUID();
  await database.query("INSERT INTO sessions(id,expires_at) VALUES($1,clock_timestamp()+interval '1 day')", [visitor]);
  const reserve = `(async()=>{const {MatchmakingStore}=await import('./src/lib/matchmaking/store.ts');const {pool}=await import('@workspace/db');const s=new MatchmakingStore();console.log(JSON.stringify(await s.reserve('${visitor}','deck')));await pool.end();})().catch(e=>{console.error(e);process.exit(1)});`;
  const results = await Promise.all(Array.from({ length: 8 }, () => run(process.execPath,
    ["--import", "tsx", "-e", reserve],
    { env: { ...process.env, PGOPTIONS: `-c search_path=${schema},public` } })));
  const responses = results.map((r) => JSON.parse(r.stdout.trim()));
  assert.equal(responses.filter((r) => r.allowed).length, 5);
  assert.equal(responses.filter((r) => !r.allowed && r.reason === "visitor_limit").length, 3);
  assert.equal(await new MatchmakingStore(database).remaining(visitor), 0);
  console.log("PASS eight independent Node processes: exactly five reservations, three visitor blocks, quota retained by a new store instance");

  const contact = "Contact alex@example.com, +1 (415) 555-0198 or https://example.com/about and www.example.org.";
  assert(!redactText(contact).includes("alex@"));
  assert(!redactText(contact).includes("415"));
  assert(!redactText(contact).includes("example"));
  const redacted = JSON.stringify(redactValue({ nested: [{ "alex@example.com": contact }], phone: 4155550198 }));
  assert(!redacted.includes("example") && !redacted.includes("415"));
  assert(redacted.includes("[removed]"));
  console.log("PASS public-history contact redaction: nested values, keys, numeric phones and URLs");
  console.log("ALL PHASE 5 ISOLATED LAUNCH CHECKS PASSED");
} finally {
  await database.end();
  await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await pool.end();
}
