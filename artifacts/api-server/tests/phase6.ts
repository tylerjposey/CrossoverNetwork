import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import pg from "pg";
import { pool } from "@workspace/db";
import { sampleProfiles } from "../src/lib/sample-profiles";
import { DeckStore, DeckActionError, deckOrder } from "../src/lib/deck-store";
import { ConnectionStore } from "../src/lib/connection-store";
import { nextStep } from "../src/lib/next-step";
import { goalStems } from "../src/lib/deck-filter";

// Isolated schema with its OWN profile sequence so IDs are deterministic and the
// shared database's sequence is never advanced. Fixture data only; no AI.
const run = promisify(execFile);
const schema = `crossover_phase6_test_${randomUUID().replaceAll("-", "")}`;
const env = { ...process.env, PGOPTIONS: `-c search_path=${schema},public` };
const database = new pg.Pool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${schema},public` });
const seed = async () => run(process.execPath, ["--import", "tsx", "-e",
  "(async()=>{const {seedIfEmpty}=await import('./src/lib/seed.ts');const {pool}=await import('@workspace/db');await seedIfEmpty();await pool.end();})().catch(e=>{console.error(e);process.exit(1)});"],
{ cwd: process.cwd(), env });
const count = async (sql: string) => (await database.query(sql)).rows[0].n as number;

try {
  await pool.query(`CREATE SCHEMA ${schema}`);
  for (const table of ["profiles", "usage_log", "sessions", "ai_requests", "swipes"]) {
    await pool.query(`CREATE TABLE ${schema}.${table} (LIKE public.${table} INCLUDING ALL)`);
  }
  await pool.query(`CREATE SEQUENCE ${schema}.profiles_id_seq`);
  await pool.query(`ALTER TABLE ${schema}.profiles ALTER COLUMN id SET DEFAULT nextval('${schema}.profiles_id_seq')`);

  // ---- A1: a database seeded by the ORIGINAL 30-profile roster ----
  const original = sampleProfiles.slice(0, 30);
  for (const p of original) {
    await database.query(
      "INSERT INTO profiles(first_name,school,major,year,headline,career_goals,interests,ask_me_about,is_sample) VALUES($1,$2,$3,$4,$5,$6,$7,$8,true)",
      [p.first_name, p.school, p.major, p.year, p.headline, p.career_goals, p.interests, p.ask_me_about],
    );
  }
  await database.query("INSERT INTO usage_log(session_id,input_text,status,is_sample) VALUES('sample-1','existing sample','success',true)");
  const before = (await database.query("SELECT * FROM profiles ORDER BY id")).rows;
  assert.equal(before.length, 30);
  await Promise.all([seed(), seed()]);
  await seed();
  assert.equal(await count("SELECT COUNT(*)::int AS n FROM profiles"), 60);
  assert.equal(await count("SELECT COUNT(DISTINCT (first_name,school,major))::int AS n FROM profiles"), 60);
  const after = (await database.query("SELECT * FROM profiles ORDER BY id")).rows;
  assert.deepEqual(after.slice(0, 30), before);
  assert.deepEqual(after.slice(30).map((p) => p.first_name), sampleProfiles.slice(30).map((p) => p.first_name));
  assert.equal(await count("SELECT COUNT(*)::int AS n FROM usage_log"), 1);
  assert.equal(await count("SELECT COUNT(*)::int AS n FROM profiles WHERE is_sample=false"), 0);
  assert(sampleProfiles.every((p) => !/@|https?:|www\.|\d{3}[\s.-]?\d{4}/.test(JSON.stringify(p))));
  console.log("PASS previously seeded 30-profile DB topped up to 60 by concurrent + restarted seeders; original rows/IDs and existing logs untouched; no contact info");

  // ---- A2: deck filter over an existing deck, no AI ----
  const decks = new DeckStore(database);
  const ids = [1, 11, 14, 2, 3, 4, 5, 6, 7, 8]; // Maya, Zara, Arjun, Jordan, Aisha, Leo, Sofia, Ethan, Priya, Noah
  const visitor = { first_name: "Alex", school: "SJSU", major: "MIS", year: "Senior",
    career_goals: "Build accessible healthcare software", interests: ["Bouldering", "Cooking"] };
  const deck = {
    visitor_profile: visitor,
    matches: ids.map((id, i) => ({ profile_id: id, match_score: 95 - i * 3,
      why_connect: "Your healthcare software goal connects with their work.", icebreaker: "Hi, I'd love to learn about your work." })),
    career_tip: { field: "Nursing", reason: "Learn about real patient needs", profile_id: 3 },
    insufficient_input: false, reason: null,
  };
  const sid = randomUUID(), deckId = randomUUID();
  await database.query("INSERT INTO sessions(id,data,expires_at) VALUES($1,$2,clock_timestamp()+interval '1 day')",
    [sid, JSON.stringify({ deck, deck_id: deckId, profile_confirmed_deck_id: deckId, edited_profile: visitor })]);
  const order = deckOrder(deck);
  let state = await decks.state(sid);
  assert.equal(state.deck_filter, "all");
  assert.deepEqual(state.visible_order, order);
  const opt = (id: string) => state.filter_options.find((o) => o.id === id)!;
  const expected = {
    other_schools: order.filter((id) => ![1, 11].includes(id)),
    other_majors: order.filter((id) => ![1, 14].includes(id)),
    shared_interests: order.filter((id) => [1, 11, 14, 3, 6].includes(id)),
    similar_goals: order.filter((id) => [1, 2, 3, 4].includes(id)),
  };
  for (const [id, list] of Object.entries(expected)) {
    assert.deepEqual({ ...opt(id) }, { id, available: true, count: list.length, remaining: list.length }, id);
  }
  assert(goalStems("Healthcare tools for accessibility").has("healt") && !goalStems("Build tools to help people").size);

  // Swipe the first card in "all", then filter to other schools.
  assert.equal(order[0], 1);
  state = await decks.swipe(sid, deckId, 1, "right"); // Maya, SJSU
  state = await decks.setFilter(sid, deckId, "other_schools");
  assert.equal(state.deck_filter, "other_schools");
  assert.deepEqual(state.visible_order, expected.other_schools);
  assert.equal(opt("other_schools").remaining, expected.other_schools.length);
  // Zara (SJSU) is next in the full deck but hidden; the server refuses her.
  assert.equal(order[1], 11);
  await assert.rejects(() => decks.swipe(sid, deckId, 11, "right"), (e: unknown) => e instanceof DeckActionError && e.code === "invalid_action");
  state = await decks.swipe(sid, deckId, expected.other_schools[0]!, "super");
  state = await decks.swipe(sid, deckId, expected.other_schools[1]!, "left");
  assert.equal(state.swipes.length, 3);
  assert.equal(state.super_connects_left, 2);
  assert.equal(state.visible_order.filter((id) => state.swipes.some((s) => s.profile_id === id)).length, 2);
  // Persisted: a fresh store instance (reload) sees the same filter.
  assert.equal((await new DeckStore(database).state(sid)).deck_filter, "other_schools");
  // Undo a visible card keeps the filter.
  state = await decks.undo(sid, deckId, state.swipes.at(-1)!.id);
  assert.equal(state.deck_filter, "other_schools");
  assert.equal(state.swipes.length, 2);
  console.log("PASS filters narrow the saved deck in order, are enforced by the server, persist across reload, keep progress and Supers; undo of a visible card keeps the filter");

  // Undo a card the filter hides: filter resets so the restored card is shown.
  state = await decks.undo(sid, deckId, state.swipes.at(-1)!.id); // the Super (other school, visible)
  state = await decks.setFilter(sid, deckId, "shared_interests");
  state = await decks.swipe(sid, deckId, 11, "right"); // Zara: shared Bouldering, SJSU
  state = await decks.setFilter(sid, deckId, "other_schools");
  state = await decks.undo(sid, deckId, state.swipes.at(-1)!.id);
  assert.equal(state.deck_filter, "all");
  assert.equal(state.visible_order.find((id) => !state.swipes.some((s) => s.profile_id === id)), 11);
  console.log("PASS undo of a card hidden by the filter resets to the full deck so the restored card is visible");

  // Unavailable filters: no school → refused; removing school later falls back to all.
  await assert.rejects(() => decks.setFilter(randomUUID(), deckId, "all"), DeckActionError);
  state = await decks.setFilter(sid, deckId, "other_schools");
  state = await decks.edit(sid, deckId, { ...visitor, school: null });
  assert.equal(state.deck_filter, "all");
  assert.equal(state.filter_options.find((o) => o.id === "other_schools")!.available, false);
  await assert.rejects(() => decks.setFilter(sid, deckId, "other_schools"), (e: unknown) => e instanceof DeckActionError && e.status === 400);
  // A new deck starts unfiltered.
  state = await decks.setFilter(sid, deckId, "other_majors");
  const newDeckId = randomUUID();
  await decks.saveSession(sid, { deck_id: newDeckId, profile_confirmed_deck_id: newDeckId });
  state = await decks.state(sid);
  assert.equal(state.deck_filter, "all");
  assert.equal(await count("SELECT COUNT(*)::int AS n FROM ai_requests"), 0);
  assert.equal(await count("SELECT COUNT(*)::int AS n FROM usage_log WHERE session_id NOT LIKE 'sample-%'"), 0);
  console.log("PASS unavailable filters are refused or fall back to all; a new deck resets the filter; zero AI reservations or logs");

  // ---- A3: deterministic next step ----
  const maya = sampleProfiles[0]!, jordan = sampleProfiles[1]!;
  const asP = (p: typeof maya) => ({ first_name: p.first_name, interests: p.interests, ask_me_about: p.ask_me_about });
  assert.equal(nextStep({ direction: "super", profile: asP(maya), visitor_profile: visitor }).kind, "coffee_chat");
  const shared = nextStep({ direction: "right", profile: asP(maya), visitor_profile: visitor });
  assert.equal(shared.kind, "shared_interest");
  assert.equal(shared.title, "Open with Bouldering");
  const ask = nextStep({ direction: "right", profile: asP(jordan), visitor_profile: visitor });
  assert.equal(ask.kind, "ask_about");
  assert(ask.text.includes("their solar forecasting side project"), ask.text);
  assert.equal(nextStep({ direction: "right", profile: asP(jordan), visitor_profile: null }).kind, "ask_about");
  const list = await new ConnectionStore(database).list(sid);
  assert(list.connections.length >= 1 && list.connections.every((c) => c.next_step && c.next_step.text.length < 240));
  assert.equal(list.connections.find((c) => c.profile.id === 1)!.next_step!.kind, "shared_interest");
  console.log("PASS next step is derived from saved match data (coffee chat / shared interest / ask about) on every connection, with no AI");
  console.log("ALL PHASE 6 PART A TESTS PASSED (fixture data only; no paid AI)");
} finally {
  await database.end();
  await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await pool.end();
}
