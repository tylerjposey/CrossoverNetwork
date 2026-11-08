import { Router, type IRouter, type Request, type Response } from "express";
import { db, profiles } from "@workspace/db";
import {
  BuildCrossoverDeckResponse, RewriteCrossoverIcebreakerResponse, GetCrossoverStateResponse,
} from "@workspace/api-zod";
import { AiActionError, MatchmakingService } from "../lib/matchmaking/service";
import { resultSchema } from "../lib/matchmaking/validate";
import { AI_BREAK_MESSAGE } from "../lib/matchmaking/config";

const router: IRouter = Router();
async function runAction(req: Request, res: Response, kind: "deck" | "rewrite"): Promise<void> {
  const service = new MatchmakingService(undefined, undefined,
    (metadata) => req.log.warn(metadata, "AI matchmaking diagnostic"));
  const sessionId = res.locals.sessionId as string;
  try {
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
router.get("/crossover/state", async (_req, res): Promise<void> => {
  const service = new MatchmakingService();
  const sessionId = res.locals.sessionId as string;
  const session = await service.store.session(sessionId);
  const deck = resultSchema.safeParse(session.deck);
  res.json(GetCrossoverStateResponse.parse({
    input_text: typeof session.input_text === "string" ? session.input_text : "",
    remaining_builds: await service.store.remaining(sessionId),
    deck_id: typeof session.deck_id === "string" ? session.deck_id : null,
    deck: deck.success ? deck.data : null,
  }));
});
export default router;
