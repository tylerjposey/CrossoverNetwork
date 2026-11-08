import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { pool, type Profile } from "@workspace/db";
import { DeckStore, DeckActionError, deckOrder } from "../src/lib/deck-store";
import { MatchmakingService } from "../src/lib/matchmaking/service";

const schema = `crossover_deck_test_${randomUUID().replaceAll("-", "")}`;
assert(/^[a-z_0-9]+$/.test(schema));
const database = new pg.Pool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${schema},public` });
const store = new DeckStore(database);
try {
  await pool.query(`CREATE SCHEMA ${schema}`);
  for (const table of ["sessions", "usage_log", "ai_requests", "swipes"]) {
    await pool.query(`CREATE TABLE ${schema}.${table} (LIKE public.${table} INCLUDING ALL)`);
  }
  const people = (await pool.query<Profile>("SELECT * FROM profiles ORDER BY id")).rows;
  const profile = { first_name: "Alex", school: "SJSU", major: "MIS", year: "Senior",
    career_goals: "Build accessible healthcare software", interests: ["Cooking", "Bouldering"] };
  const deck = {
    visitor_profile: profile,
    matches: people.slice(0, 10).map((p, i) => ({
      profile_id: p.id, match_score: 95 - i * 2,
      why_connect: `Your healthcare software goal connects with ${p.first_name}'s interest in ${p.career_goals.toLowerCase()}`,
      icebreaker: `Hi ${p.first_name}, I'm exploring healthcare software and would love to hear about ${p.ask_me_about.toLowerCase()}`,
    })),
    career_tip: { field: people[2]!.major, reason: "Learn about real patient needs", profile_id: people[2]!.id },
    insufficient_input: false, reason: null,
  };
  const id = randomUUID(), deckId = randomUUID();
  await database.query("INSERT INTO sessions(id,data,expires_at) VALUES($1,$2,clock_timestamp()+interval '1 day')",
    [id, JSON.stringify({ deck, deck_id: deckId, input_text: "I study MIS at SJSU and want to build accessible healthcare software. I enjoy cooking and bouldering." })]);
  const initial = await store.state(id);
  assert.equal(initial.profile_confirmed, false);
  assert.equal(initial.super_connects_left, 3);
  assert.equal(initial.deck_order[5], deck.career_tip.profile_id);
  assert.equal(new Set(initial.deck_order).size, 10);
  assert.equal(deckOrder(deck).length, 10);
  console.log("PASS wildcard appears sixth, with ten unique cards and profile review first");

  async function rejects(action: () => Promise<unknown>, code: string) {
    await assert.rejects(action, (error: unknown) => error instanceof DeckActionError && error.code === code);
  }
  await rejects(() => store.swipe(id, deckId, initial.deck_order[0]!, "right"), "confirm_profile");
  const edited = { ...profile, school: "Reed College", major: "Anthropology", interests: ["Birdwatching", "Cooking"] };
  const editState = await store.edit(id, deckId, edited);
  assert.equal(editState.visitor_profile?.school, "Reed College");
  assert.deepEqual(editState.deck, initial.deck);
  assert.equal(editState.remaining_builds, 5);
  assert.equal(editState.profile_confirmed, false);
  await store.confirm(id, deckId);
  console.log("PASS all profile edits persist with no AI/quota use and leave the original deck unchanged");

  const first = initial.deck_order[0]!;
  const duplicate = await Promise.all([
    store.swipe(id, deckId, first, "super"), store.swipe(id, deckId, first, "super"),
  ]);
  assert(duplicate.every((s) => s.swipes.length === 1 && s.super_connects_left === 2));
  let state = await store.state(id);
  await store.swipe(id, deckId, initial.deck_order[1]!, "super");
  state = await store.swipe(id, deckId, initial.deck_order[2]!, "super");
  assert.equal(state.super_connects_left, 0);
  await rejects(() => store.swipe(id, deckId, initial.deck_order[3]!, "super"), "super_limit");
  assert.equal((await store.state(id)).swipes.length, 3);
  console.log("PASS duplicate requests are idempotent and a fourth Super Connect is rejected server-side");

  const lastId = state.swipes.at(-1)!.id;
  state = await store.undo(id, deckId, lastId);
  assert.equal(state.swipes.length, 2);
  assert.equal(state.super_connects_left, 1);
  await rejects(() => store.undo(id, deckId, lastId), "invalid_action");
  state = await store.swipe(id, deckId, initial.deck_order[2]!, "right");
  assert.equal(state.swipes.at(-1)!.direction, "right");
  state = await store.swipe(id, deckId, initial.deck_order[3]!, "left");
  assert.equal(state.swipes.at(-1)!.direction, "left");
  await rejects(() => store.swipe(id, deckId, 99999, "right"), "invalid_action");
  await rejects(() => store.swipe(id, randomUUID(), first, "right"), "stale_deck");
  await rejects(() => store.undo(id, deckId, state.swipes[0]!.id), "invalid_action");
  console.log("PASS undo restores the card/Super, rejects stale undo and wrong deck; Pass and Connect persist");

  const resumed = await new DeckStore(database).state(id);
  assert.deepEqual(resumed, state);
  const quota = (await database.query("SELECT COUNT(*)::int AS n FROM ai_requests")).rows[0].n;
  const usage = (await database.query("SELECT COUNT(*)::int AS n FROM usage_log")).rows[0].n;
  assert.equal(quota, 0);
  assert.equal(usage, 0);
  const snapshots = (await database.query("SELECT match_snapshot FROM swipes WHERE session_id=$1", [id])).rows;
  assert(snapshots.every((row) => row.match_snapshot.icebreaker && row.match_snapshot.visitor_profile));
  console.log("PASS reload/new instance resumes identical progress; all actions make zero AI requests; connection evidence preserved");

  const otherId = randomUUID();
  await database.query("INSERT INTO sessions(id,data,expires_at) VALUES($1,'{}',clock_timestamp()+interval '1 day')", [otherId]);
  assert.equal((await store.state(otherId)).swipes.length, 0);
  await rejects(() => store.undo(otherId, deckId, state.swipes[0]!.id), "stale_deck");
  console.log("PASS session isolation: another visitor cannot access or undo these swipes");

  let providerCalls = 0;
  const service = new MatchmakingService(store, async ({ user }) => {
    providerCalls++;
    assert(user.includes("Reed College") && user.includes("Anthropology") && user.includes("new text"));
    return { text: JSON.stringify({ ...deck, visitor_profile: edited }), stopReason: "end_turn" };
  });
  const next = await service.build(id, { input_text: "new text" }, people);
  assert.equal(providerCalls, 1);
  assert.notEqual(next.deck_id, deckId);
  const rebuilt = await store.state(id);
  assert.equal(rebuilt.swipes.length, 0);
  assert.equal(rebuilt.super_connects_left, 3);
  assert.equal(rebuilt.profile_confirmed, false);
  assert.equal(rebuilt.visitor_profile?.school, "Reed College");
  assert.equal((await database.query("SELECT COUNT(*)::int AS n FROM swipes WHERE session_id=$1", [id])).rows[0].n, 4);
  await rejects(() => store.edit(id, deckId, profile), "stale_deck");
  console.log("PASS next build uses saved edits plus new text; resets current progress, keeps prior swipe history and rejects stale edits");
  console.log("ALL PHASE 3 DATABASE TESTS PASSED (fixture provider only; no paid AI)");
} finally {
  await database.end();
  await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await pool.end();
}
