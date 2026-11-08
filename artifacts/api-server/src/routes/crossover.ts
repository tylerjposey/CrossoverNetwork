import { Router, type IRouter } from "express";
import { db, profiles, usageLog } from "@workspace/db";
import { desc } from "drizzle-orm";
import { GetCrossoverHistoryResponse, GetCrossoverProfilesResponse } from "@workspace/api-zod";
import { anonymousSession, parseSessionCookie } from "../middlewares/anonymous-session";
import { redactText, redactValue } from "../lib/redact";

const router: IRouter = Router();
router.use("/crossover", parseSessionCookie, anonymousSession);
router.get("/crossover/profiles", async (_req, res): Promise<void> => {
  res.json(GetCrossoverProfilesResponse.parse(await db.select().from(profiles).orderBy(profiles.id)));
});
router.get("/crossover/history", async (_req, res): Promise<void> => {
  const [logs, people] = await Promise.all([
    db.select().from(usageLog).orderBy(desc(usageLog.created_at), desc(usageLog.id)),
    db.select().from(profiles),
  ]);
  const names = new Map(people.map((p) => [p.id, p.first_name]));
  const records = logs.map((row) => {
    const output = redactValue(row.ai_output) as Record<string, unknown> | null;
    const matches = Array.isArray(output?.matches) ? output.matches : [];
    const tip = output?.career_tip;
    const reason = tip && typeof tip === "object" && "reason" in tip ? String(tip.reason) : "";
    return {
      id: row.id, input_text: redactText(row.input_text),
      status: row.status, is_sample: row.is_sample,
      is_yours: !row.is_sample && row.session_id === res.locals.sessionId,
      created_at: row.created_at.toISOString(),
      top_matches: matches.slice(0, 3).map((m: unknown) => {
        const id = m && typeof m === "object" && "profile_id" in m ? Number(m.profile_id) : NaN;
        return redactText(names.get(id) ?? "Unavailable profile");
      }),
      career_tip: redactText(reason),
      output_json: output ? JSON.stringify(output, null, 2) : "",
    };
  });
  res.json(GetCrossoverHistoryResponse.parse({
    records, total: logs.length, sample_count: logs.filter((l) => l.is_sample).length,
    profile_count: people.length, school_count: new Set(people.map((p) => p.school)).size,
  }));
});
export default router;
