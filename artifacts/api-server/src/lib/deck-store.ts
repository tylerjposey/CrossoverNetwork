import type { Pool, PoolClient } from "pg";
import { GetCrossoverStateResponse } from "@workspace/api-zod";
import { MatchmakingStore } from "./matchmaking/store";
import { resultSchema, type MatchmakingResult } from "./matchmaking/validate";
import { VISITOR_HOURLY_AI_CAP } from "./matchmaking/config";

export class DeckActionError extends Error {
  constructor(readonly status: number, readonly code: "invalid_action" | "stale_deck" | "super_limit" | "confirm_profile", message: string) {
    super(message);
  }
}
export function deckOrder(deck: MatchmakingResult): number[] {
  const ids = deck.matches.map((m) => m.profile_id);
  const wildcard = deck.career_tip?.profile_id;
  if (wildcard === undefined || !ids.includes(wildcard)) return ids;
  const rest = ids.filter((id) => id !== wildcard);
  rest.splice(Math.min(5, rest.length), 0, wildcard);
  return rest;
}

type Queryable = Pick<Pool, "query">;
export class DeckStore extends MatchmakingStore {
  async state(sessionId: string, database: Queryable = this.database) {
    const { rows } = await database.query("SELECT data FROM sessions WHERE id=$1", [sessionId]);
    if (!rows[0]) throw new Error("Anonymous session missing");
    const session = rows[0].data as Record<string, unknown>;
    const parsed = resultSchema.safeParse(session.deck);
    const deck = parsed.success ? parsed.data : null;
    const deckId = typeof session.deck_id === "string" && deck ? session.deck_id : null;
    const profile = resultSchema.shape.visitor_profile.safeParse(
      session.edited_profile ?? session.visitor_profile ?? deck?.visitor_profile ?? null,
    );
    const { rows: swipes } = await database.query(
      "SELECT id,profile_id,direction,created_at,match_snapshot FROM swipes WHERE session_id=$1 AND deck_id=$2 ORDER BY id",
      [sessionId, deckId],
    );
    const { rows: reservations } = await database.query(
      "SELECT COUNT(*)::int AS used FROM ai_requests WHERE session_id=$1 AND created_at > clock_timestamp()-interval '1 hour'",
      [sessionId],
    );
    const connected = swipes.filter((s) => s.direction !== "left");
    const { rows: people } = connected.length ? await database.query(
      "SELECT id,interests FROM profiles WHERE id=ANY($1::int[])", [connected.map((s) => s.profile_id)],
    ) : { rows: [] };
    const shared = new Map<string, { label: string; count: number }>();
    for (const swipe of connected) {
      const visitorInterests = new Set<string>(
        (swipe.match_snapshot?.visitor_profile?.interests ?? []).map((s: string) => s.trim().toLowerCase()),
      );
      const person = people.find((p) => p.id === swipe.profile_id);
      for (const label of (person?.interests ?? []) as string[]) {
        const key = label.trim().toLowerCase();
        if (!visitorInterests.has(key)) continue;
        const existing = shared.get(key);
        shared.set(key, { label, count: (existing?.count ?? 0) + 1 });
      }
    }
    const top = [...shared.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))[0];
    return GetCrossoverStateResponse.parse({
      input_text: typeof session.input_text === "string" ? session.input_text : "",
      remaining_builds: Math.max(0, VISITOR_HOURLY_AI_CAP - reservations[0].used),
      deck_id: deckId, deck, visitor_profile: profile.success ? profile.data : null,
      profile_confirmed: !!deckId && session.profile_confirmed_deck_id === deckId,
      deck_order: deck ? deckOrder(deck) : [],
      swipes: swipes.map((row) => ({
        id: row.id, profile_id: row.profile_id, direction: row.direction, created_at: row.created_at.toISOString(),
      })),
      super_connects_left: Math.max(0, 3 - swipes.filter((s) => s.direction === "super").length),
      deck_summary: { connections_made: connected.length, top_shared_interest: top?.label ?? null },
    });
  }

  // Every action locks the session row, so multiple tabs/instances cannot
  // advance the same card twice, spend a fourth Super, or undo the wrong card.
  private async change(sessionId: string, deckId: string, action: (client: PoolClient, session: Record<string, unknown>, deck: MatchmakingResult) => Promise<void>) {
    const client = await this.database.connect();
    try {
      await client.query("BEGIN");
      const { rows } = await client.query("SELECT data FROM sessions WHERE id=$1 FOR UPDATE", [sessionId]);
      const session = rows[0]?.data as Record<string, unknown> | undefined;
      const parsed = resultSchema.safeParse(session?.deck);
      if (!session || session.deck_id !== deckId || !parsed.success || parsed.data.insufficient_input) {
        throw new DeckActionError(409, "stale_deck", "Your deck changed. Refresh to pick up where you left off.");
      }
      await action(client, session, parsed.data);
      const state = await this.state(sessionId, client);
      await client.query("COMMIT");
      return state;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async edit(sessionId: string, deckId: string, profile: NonNullable<MatchmakingResult["visitor_profile"]>) {
    const clean = {
      first_name: profile.first_name?.trim() || null,
      school: profile.school?.trim() || null,
      major: profile.major?.trim() || null,
      year: profile.year?.trim() || null,
      career_goals: profile.career_goals.trim(),
      interests: [...new Set(profile.interests.map((s) => s.trim()).filter(Boolean))],
    };
    return this.change(sessionId, deckId, async (client) => {
      await client.query("UPDATE sessions SET data=data || $2::jsonb WHERE id=$1",
        [sessionId, JSON.stringify({ edited_profile: clean, visitor_profile: clean })]);
    });
  }

  async confirm(sessionId: string, deckId: string) {
    return this.change(sessionId, deckId, async (client) => {
      await client.query("UPDATE sessions SET data=data || $2::jsonb WHERE id=$1",
        [sessionId, JSON.stringify({ profile_confirmed_deck_id: deckId })]);
    });
  }

  async swipe(sessionId: string, deckId: string, profileId: number, direction: "left" | "right" | "super") {
    return this.change(sessionId, deckId, async (client, session, deck) => {
      if (session.profile_confirmed_deck_id !== deckId) {
        throw new DeckActionError(409, "confirm_profile", "Review your profile card before swiping.");
      }
      const { rows } = await client.query(
        "SELECT id,profile_id,direction FROM swipes WHERE session_id=$1 AND deck_id=$2 ORDER BY id", [sessionId, deckId],
      );
      const previous = rows.find((s) => s.profile_id === profileId);
      if (previous?.direction === direction) return; // Safe replay after a lost response.
      const next = deckOrder(deck).find((id) => !rows.some((s) => s.profile_id === id));
      if (next !== profileId || previous) {
        throw new DeckActionError(409, "invalid_action", "That card has already changed. Refresh your deck and try again.");
      }
      if (direction === "super" && rows.filter((s) => s.direction === "super").length >= 3) {
        throw new DeckActionError(409, "super_limit", "You've used all 3 Super Connects in this deck.");
      }
      const match = deck.matches.find((m) => m.profile_id === profileId)!;
      await client.query(
        "INSERT INTO swipes(session_id,deck_id,profile_id,direction,match_snapshot) VALUES($1,$2,$3,$4,$5)",
        [sessionId, deckId, profileId, direction, JSON.stringify({
          ...match, visitor_profile: session.edited_profile ?? deck.visitor_profile,
        })],
      );
    });
  }

  async undo(sessionId: string, deckId: string, swipeId: number) {
    return this.change(sessionId, deckId, async (client) => {
      const { rows } = await client.query(
        "SELECT id FROM swipes WHERE session_id=$1 AND deck_id=$2 ORDER BY id DESC LIMIT 1", [sessionId, deckId],
      );
      if (rows[0]?.id !== swipeId) {
        throw new DeckActionError(409, "invalid_action", "Your last swipe changed. Refresh your deck before undoing.");
      }
      await client.query("DELETE FROM swipes WHERE id=$1 AND session_id=$2 AND deck_id=$3", [swipeId, sessionId, deckId]);
    });
  }
}
