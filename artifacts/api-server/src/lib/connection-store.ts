import type { Pool } from "pg";
import { GetCrossoverConnectionsResponse } from "@workspace/api-zod";
import { DeckActionError } from "./deck-store";
import { MatchmakingStore } from "./matchmaking/store";
import { nextStep } from "./next-step";

const connectionSchema = GetCrossoverConnectionsResponse.shape.connections.element;
type Queryable = Pick<Pool, "query">;
export class ConnectionStore extends MatchmakingStore {
  async connections(sessionId: string, database: Queryable = this.database, id?: number) {
    const { rows } = await database.query(
      `SELECT s.id,s.deck_id,s.direction,s.created_at,s.match_snapshot,to_jsonb(p) AS profile
       FROM swipes s JOIN profiles p ON p.id=s.profile_id
       WHERE s.session_id=$1 AND s.direction IN ('right','super')
         AND ($2::int IS NULL OR s.id=$2)
       ORDER BY s.id DESC`, [sessionId, id ?? null],
    );
    return rows.map((row) => {
      const base = {
        ...row.match_snapshot, id: row.id, deck_id: row.deck_id,
        direction: row.direction, profile: row.profile, created_at: row.created_at.toISOString(),
      };
      return connectionSchema.parse({ ...base, next_step: nextStep(base), reply: row.match_snapshot?.reply ?? null });
    });
  }
  async get(sessionId: string, id: number, database: Queryable = this.database) {
    const connection = (await this.connections(sessionId, database, id))[0];
    if (!connection) throw new DeckActionError(409, "stale_deck", "That connection changed. Refresh your Connections and try again.");
    return connection;
  }
  async list(sessionId: string) {
    return GetCrossoverConnectionsResponse.parse({
      connections: await this.connections(sessionId), remaining_builds: await this.remaining(sessionId),
    });
  }
  async edit(sessionId: string, id: number, icebreaker: string) {
    const connection = await this.get(sessionId, id);
    return (await this.persistDraft(sessionId, connection.profile.id, icebreaker, connection.deck_id, id))!;
  }
  // Same lock order as swipe/undo/drafts. If the connection was undone while the
  // AI call was in flight, nothing is written and the caller gets stale_deck.
  async persistReply(sessionId: string, id: number, reply: { text: string; replied_to: string; created_at: string }) {
    const client = await this.database.connect();
    try {
      await client.query("BEGIN");
      const { rows: sessions } = await client.query("SELECT 1 FROM sessions WHERE id=$1 FOR UPDATE", [sessionId]);
      if (!sessions[0]) throw new Error("Anonymous session missing");
      const { rows } = await client.query(
        `UPDATE swipes SET match_snapshot=jsonb_set(match_snapshot,'{reply}',$3::jsonb)
         WHERE id=$2 AND session_id=$1 AND direction IN ('right','super') RETURNING id`,
        [sessionId, id, JSON.stringify(reply)],
      );
      if (!rows[0]) throw new DeckActionError(409, "stale_deck", "That connection changed. Refresh your Connections and try again.");
      const connection = await this.get(sessionId, id, client);
      await client.query("COMMIT");
      return connection;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  // Lock in the same order as swipe/undo: session first, then its swipe rows.
  // A rewrite of an older deck updates its snapshot, never the new deck.
  async persistDraft(sessionId: string, profileId: number, icebreaker: string, deckId: string, connectionId?: number) {
    const client = await this.database.connect();
    try {
      await client.query("BEGIN");
      const { rows: sessions } = await client.query("SELECT data FROM sessions WHERE id=$1 FOR UPDATE", [sessionId]);
      if (!sessions[0]) throw new Error("Anonymous session missing");
      const { rows } = await client.query(
        `UPDATE swipes SET match_snapshot=jsonb_set(match_snapshot,'{icebreaker}',to_jsonb($3::text))
         WHERE session_id=$1 AND profile_id=$2 AND deck_id=$4 AND direction IN ('right','super')
           AND ($5::int IS NULL OR id=$5) RETURNING id`,
        [sessionId, profileId, icebreaker, deckId, connectionId ?? null],
      );
      if (connectionId !== undefined && !rows[0]) {
        throw new DeckActionError(409, "stale_deck", "That connection changed. Refresh your Connections and try again.");
      }
      const updated = await client.query(
        `UPDATE sessions SET data=jsonb_set(data,'{deck,matches}',(
          SELECT jsonb_agg(CASE WHEN (m->>'profile_id')::int=$2
          THEN jsonb_set(m,'{icebreaker}',to_jsonb($3::text)) ELSE m END ORDER BY ordinal)
          FROM jsonb_array_elements(data->'deck'->'matches') WITH ORDINALITY AS e(m,ordinal)
        )) WHERE id=$1 AND data->>'deck_id'=$4`,
        [sessionId, profileId, icebreaker, deckId],
      );
      if (!rows[0] && !updated.rowCount) {
        throw new DeckActionError(409, "stale_deck", "Your deck changed. Refresh to pick up where you left off.");
      }
      const connection = rows[0] ? await this.get(sessionId, rows[0].id, client) : null;
      await client.query("COMMIT");
      return connection;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
