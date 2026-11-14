import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { pool } from "@workspace/db";
import { GLOBAL_DAILY_AI_CAP, VISITOR_HOURLY_AI_CAP } from "./config";

export type Reservation = { allowed: true; id: string } | { allowed: false; reason: "global_limit" | "visitor_limit" };

export class MatchmakingStore {
  constructor(readonly database: Pool = pool, readonly dailyCap = GLOBAL_DAILY_AI_CAP) {}

  async remaining(sessionId: string): Promise<number> {
    const { rows } = await this.database.query(
      "SELECT COUNT(*)::int AS used FROM ai_requests WHERE session_id = $1 AND created_at > clock_timestamp() - INTERVAL '1 hour'",
      [sessionId],
    );
    return Math.max(0, VISITOR_HOURLY_AI_CAP - rows[0].used);
  }

  async reserve(sessionId: string, kind: "deck" | "rewrite" | "reply"): Promise<Reservation> {
    const client = await this.database.connect();
    try {
      await client.query("BEGIN");
      // Global first: all instances serialize only the short quota reservation,
      // never the model call. A fixed lock also makes midnight rollover safe.
      await client.query("SELECT pg_advisory_xact_lock(87309122)");
      const { rows: clock } = await client.query("SELECT clock_timestamp() AS instant");
      const instant = clock[0].instant as Date;
      const { rows: global } = await client.query(
        `SELECT COUNT(*)::int AS used FROM ai_requests
         WHERE created_at >= (date_trunc('day', $1::timestamptz AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')
           AND created_at < (date_trunc('day', $1::timestamptz AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') + INTERVAL '24 hours'`,
        [instant],
      );
      if (global[0].used >= this.dailyCap) {
        await client.query("COMMIT");
        return { allowed: false, reason: "global_limit" };
      }
      const { rows: visitor } = await client.query(
        "SELECT COUNT(*)::int AS used FROM ai_requests WHERE session_id = $1 AND created_at > $2::timestamptz - INTERVAL '1 hour'", [sessionId, instant],
      );
      if (visitor[0].used >= VISITOR_HOURLY_AI_CAP) {
        await client.query("COMMIT");
        return { allowed: false, reason: "visitor_limit" };
      }
      const id = randomUUID();
      await client.query("INSERT INTO ai_requests (id, session_id, kind, created_at) VALUES ($1, $2, $3, $4)", [id, sessionId, kind, instant]);
      await client.query("COMMIT");
      return { allowed: true, id };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async log(sessionId: string, text: string, status: "success" | "error" | "rate_limited" | "invalid_input", output: unknown = null): Promise<number> {
    const { rows } = await this.database.query(
      "INSERT INTO usage_log (session_id,input_text,status,ai_output,is_sample) VALUES ($1,$2,$3,$4,false) RETURNING id",
      [sessionId, text, status, output === null ? null : JSON.stringify(output)],
    );
    return rows[0].id;
  }

  async session(sessionId: string): Promise<Record<string, unknown>> {
    const { rows } = await this.database.query("SELECT data FROM sessions WHERE id=$1", [sessionId]);
    if (!rows[0]) throw new Error("Anonymous session missing");
    return rows[0].data;
  }

  async saveSession(sessionId: string, patch: Record<string, unknown>): Promise<void> {
    await this.database.query("UPDATE sessions SET data = data || $2::jsonb WHERE id=$1", [sessionId, JSON.stringify(patch)]);
  }
}
