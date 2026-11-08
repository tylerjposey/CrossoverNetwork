import { Router, type IRouter } from "express";
import {
  UpdateCrossoverProfileBody, ConfirmCrossoverProfileBody,
  CreateCrossoverSwipeBody, UndoCrossoverSwipeBody,
  EditCrossoverIcebreakerBody, EditCrossoverIcebreakerParams, EditCrossoverIcebreakerResponse,
} from "@workspace/api-zod";
import { DeckActionError, DeckStore } from "../lib/deck-store";
import { ConnectionStore } from "../lib/connection-store";

const router: IRouter = Router();
const store = new DeckStore();
const connections = new ConnectionStore();
function check<T extends { success: boolean }>(parsed: T): asserts parsed is T & { success: true } {
  if (!parsed.success) throw new DeckActionError(400, "invalid_action", "Please check your details and try again.");
}
router.get("/crossover/connections", async (_req, res): Promise<void> => {
  res.json(await connections.list(res.locals.sessionId));
});
router.patch("/crossover/connections/:id/icebreaker", async (req, res): Promise<void> => {
  const params = EditCrossoverIcebreakerParams.safeParse(req.params);
  const body = EditCrossoverIcebreakerBody.strict().safeParse(req.body);
  check(params); check(body);
  if (!body.data.icebreaker.trim()) throw new DeckActionError(400, "invalid_action", "Write a little something before saving your draft.");
  res.json(EditCrossoverIcebreakerResponse.parse(await connections.edit(
    res.locals.sessionId, params.data.id, body.data.icebreaker.trim(),
  )));
});
router.patch("/crossover/profile", async (req, res): Promise<void> => {
  const parsed = UpdateCrossoverProfileBody.strict().safeParse(req.body);
  check(parsed);
  res.json(await store.edit(res.locals.sessionId, parsed.data.deck_id, parsed.data.profile));
});
router.post("/crossover/profile/confirm", async (req, res): Promise<void> => {
  const parsed = ConfirmCrossoverProfileBody.strict().safeParse(req.body);
  check(parsed);
  res.json(await store.confirm(res.locals.sessionId, parsed.data.deck_id));
});
router.post("/crossover/swipes", async (req, res): Promise<void> => {
  const parsed = CreateCrossoverSwipeBody.strict().safeParse(req.body);
  check(parsed);
  res.json(await store.swipe(res.locals.sessionId, parsed.data.deck_id, parsed.data.profile_id, parsed.data.direction));
});
router.post("/crossover/swipes/undo", async (req, res): Promise<void> => {
  const parsed = UndoCrossoverSwipeBody.strict().safeParse(req.body);
  check(parsed);
  res.json(await store.undo(res.locals.sessionId, parsed.data.deck_id, parsed.data.swipe_id));
});
router.use((error: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (error instanceof DeckActionError) res.status(error.status).json({ error: error.message, code: error.code });
  else next(error);
});
import type express from "express";
export default router;
