import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { pool, type Profile } from "@workspace/db";
import { DeckStore, DeckActionError } from "../src/lib/deck-store";
import { ConnectionStore } from "../src/lib/connection-store";
import { AiActionError, MatchmakingService } from "../src/lib/matchmaking/service";
import { AI_BREAK_MESSAGE, VISITOR_LIMIT_MESSAGE } from "../src/lib/matchmaking/config";

const schema = `crossover_connections_test_${randomUUID().replaceAll("-", "")}`;
const database = new pg.Pool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${schema},public` });
const decks = new DeckStore(database);
const connections = new ConnectionStore(database);
try {
  await pool.query(`CREATE SCHEMA ${schema}`);
  for (const table of ["sessions", "usage_log", "ai_requests", "swipes"]) {
    await pool.query(`CREATE TABLE ${schema}.${table} (LIKE public.${table} INCLUDING ALL)`);
  }
  const people = (await pool.query<Profile>("SELECT * FROM profiles ORDER BY id")).rows;
  const visitor = { first_name: "Alex", school: "SJSU", major: "MIS", year: "Senior",
    career_goals: "Build accessible healthcare software", interests: people[0]!.interests.slice(0, 2) };
  const deck = {
    visitor_profile: visitor,
    matches: people.slice(0, 10).map((p, i) => ({
      profile_id: p.id, match_score: i === 0 ? 90 : i === 1 ? 70 : 60,
      why_connect: `Your healthcare software goal connects with ${p.first_name}'s work.`,
      icebreaker: `Hi ${p.first_name}, I'd love to learn about your work.`,
    })),
    career_tip: { field: people[7]!.major, reason: "Learn about real patient needs", profile_id: people[7]!.id },
    insufficient_input: false, reason: null,
  };
  const id = randomUUID(), other = randomUUID(), deckId = randomUUID();
  for (const sid of [id, other]) {
    await database.query("INSERT INTO sessions(id,data,expires_at) VALUES($1,$2,clock_timestamp()+interval '1 day')", [
      sid, JSON.stringify(sid === id ? {
        deck, deck_id: deckId, profile_confirmed_deck_id: deckId, edited_profile: visitor,
      } : {}),
    ]);
  }
  const order = (await decks.state(id)).deck_order;
  await decks.swipe(id, deckId, order[0]!, "right");
  await decks.swipe(id, deckId, order[1]!, "right");
  await decks.swipe(id, deckId, order[2]!, "super");
  await decks.swipe(id, deckId, order[3]!, "left");
  let list = await connections.list(id);
  assert.equal(list.connections.length, 3);
  assert.equal(list.connections.filter((c) => c.match_score < 75 && c.direction === "right").length, 1);
  assert.equal(list.connections.filter((c) => c.direction === "super").length, 1);
  const state = await decks.state(id);
  assert.equal(state.deck_summary.connections_made, 3);
  assert(visitor.interests.includes(state.deck_summary.top_shared_interest!));
  assert.equal((await connections.list(other)).connections.length, 0);
  const first = list.connections.find((c) => c.profile.id === order[0])!;
  await assert.rejects(() => connections.get(other, first.id), DeckActionError);
  console.log("PASS all high/low-score Connects and Supers are saved; Passes excluded; summary is real and session-owned");

  const manual = "Hi, I'd love to compare notes on accessible healthcare tools. Could we chat?";
  await connections.edit(id, first.id, manual);
  assert.equal((await new ConnectionStore(database).get(id, first.id)).icebreaker, manual);
  assert.equal((await decks.state(id)).deck!.matches.find((m) => m.profile_id === first.profile.id)!.icebreaker, manual);
  assert.equal((await connections.list(id)).remaining_builds, 5);
  assert.equal((await database.query("SELECT COUNT(*)::int AS n FROM ai_requests")).rows[0].n, 0);
  console.log("PASS manual draft edits persist on reload and sync to the current deck without AI/quota use");

  const newDeckId = randomUUID();
  const newDeck = { ...deck, visitor_profile: { ...visitor, first_name: "Blake", major: "Design" } };
  await decks.saveSession(id, {
    deck: newDeck, deck_id: newDeckId, edited_profile: newDeck.visitor_profile,
    profile_confirmed_deck_id: newDeckId,
  });
  assert.equal((await connections.list(id)).connections.length, 3);
  assert.equal((await decks.state(id)).deck_summary.connections_made, 0);
  let calls = 0;
  const service = new MatchmakingService(decks, async ({ user, maxTokens }) => {
    calls++;
    assert(user.includes("Alex") && user.includes(manual));
    assert.equal(maxTokens, 500);
    return { text: JSON.stringify({ icebreaker: "Hi, could we swap ideas on accessible healthcare software?" }), stopReason: "end_turn" };
  });
  const rewritten = await service.rewrite(id, { profile_id: first.profile.id, connection_id: first.id }, people);
  assert.equal(rewritten.connection_id, first.id);
  assert.equal(rewritten.remaining_builds, 4);
  assert.equal((await connections.get(id, first.id)).icebreaker, rewritten.icebreaker);
  assert.deepEqual((await decks.state(id)).deck, newDeck);
  await assert.rejects(() => service.rewrite(other, { profile_id: first.profile.id, connection_id: first.id }, people),
    (e: unknown) => e instanceof AiActionError && e.code === "invalid_profile");
  assert.equal(calls, 1);
  console.log("PASS old-deck rewrites use its saved profile/draft, share quota, persist, never modify a new deck; foreign IDs make no AI call");

  await decks.swipe(id, newDeckId, order[0]!, "super");
  list = await connections.list(id);
  assert.equal(list.connections.length, 4);
  const newest = list.connections[0]!;
  assert.notEqual(newest.id, first.id);
  let entered!: () => void, release!: () => void;
  const started = new Promise<void>((resolve) => { entered = resolve; });
  const wait = new Promise<void>((resolve) => { release = resolve; });
  const slow = new MatchmakingService(decks, async () => {
    entered(); await wait;
    return { text: JSON.stringify({ icebreaker: "A late rewrite must not resurrect an undone connection." }), stopReason: "end_turn" };
  });
  const pending = slow.rewrite(id, { profile_id: newest.profile.id, connection_id: newest.id }, people);
  await started;
  await decks.undo(id, newDeckId, newest.id);
  release();
  await assert.rejects(() => pending, (e: unknown) => e instanceof AiActionError && e.code === "invalid_profile");
  assert.equal((await connections.list(id)).connections.length, 3);
  assert.equal((await decks.state(id)).super_connects_left, 3);
  console.log("PASS undo removes the connection/restores Super; an in-flight rewrite cannot resurrect it");

  const failureService = new MatchmakingService(decks, async () => { throw new Error("fixture failure"); });
  const beforeFailure = (await connections.get(id, first.id)).icebreaker;
  await assert.rejects(() => failureService.rewrite(id, { profile_id: first.profile.id, connection_id: first.id }, people),
    (e: unknown) => e instanceof AiActionError && e.message === AI_BREAK_MESSAGE);
  assert.equal((await connections.get(id, first.id)).icebreaker, beforeFailure);
  assert.equal((await connections.list(id)).remaining_builds, 2);
  await decks.reserve(id, "deck");
  await decks.reserve(id, "deck");
  let blockedCalls = 0;
  const blocked = new MatchmakingService(decks, async () => {
    blockedCalls++; throw new Error("Should not be called");
  });
  await assert.rejects(() => blocked.rewrite(id, { profile_id: first.profile.id, connection_id: first.id }, people),
    (e: unknown) => e instanceof AiActionError && e.message === VISITOR_LIMIT_MESSAGE);
  assert.equal(blockedCalls, 0);
  assert.equal((await connections.get(id, first.id)).icebreaker, beforeFailure);
  console.log("PASS failed rewrite retains the draft; shared build/rewrite quota blocks before the provider");
  console.log("ALL PHASE 4 DATABASE TESTS PASSED (fixture provider only; no paid AI)");
} finally {
  await database.end();
  await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await pool.end();
}
