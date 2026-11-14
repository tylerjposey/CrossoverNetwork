import { Router, type IRouter, type Request, type Response } from "express";
import { db, profiles } from "@workspace/db";
import {
  BuildCrossoverDeckResponse, RewriteCrossoverIcebreakerResponse, GetCrossoverStateResponse,
  SimulateCrossoverReplyResponse,
} from "@workspace/api-zod";
import { AiActionError, MatchmakingService } from "../lib/matchmaking/service";
import { AI_BREAK_MESSAGE } from "../lib/matchmaking/config";
import { DeckStore } from "../lib/deck-store";

const router: IRouter = Router();
async function runAction(req: Request, res: Response, kind: "deck" | "rewrite" | "reply"): Promise<void> {
  const service = new MatchmakingService(undefined, undefined,
    (metadata) => req.log.warn(metadata, "AI matchmaking diagnostic"));
  const sessionId = res.locals.sessionId as string;
  try {
    if (kind === "reply") {
      res.json(SimulateCrossoverReplyResponse.parse(await service.reply(sessionId, Number(req.params.id), req.body)));
      return;
    }
    const people = await db.select().from(profiles);
    if (kind === "deck") res.json(BuildCrossoverDeckResponse.parse(await service.build(sessionId, req.body, people)));
    else res.json(RewriteCrossoverIcebreakerResponse.parse(await service.rewrite(sessionId, req.body, people)));
  } catch (error) {
    if (error instanceof AiActionError) {
      res.status(error.status).json({ error: error.message, code: error.code, remaining_builds: await service.store.remaining(sessionId) });
    } else {
      // Infrastructure/validation faults must also produce an audit record.
      req.log.error({ failureType: error instanceof Error ? error.name : "unknown" }, "AI route infrastructure failure");
      await service.store.log(sessionId, typeof req.body?.input_text === "string" ? req.body.input_text : "", "error", { reason: AI_BREAK_MESSAGE });
      res.status(503).json({ error: AI_BREAK_MESSAGE, code: "ai_unavailable", remaining_builds: await service.store.remaining(sessionId) });
    }
  }
}
router.post("/crossover/deck", (req, res) => runAction(req, res, "deck"));
router.post("/crossover/icebreaker/rewrite", (req, res) => runAction(req, res, "rewrite"));
router.post("/crossover/connections/:id/reply", (req, res) => runAction(req, res, "reply"));
router.get("/crossover/state", async (_req, res): Promise<void> => {
  const sessionId = res.locals.sessionId as string;
  res.json(GetCrossoverStateResponse.parse(await new DeckStore().state(sessionId)));
});
export default router;
