import { Router, type IRouter } from "express";
import {
  UpdateCrossoverProfileBody, ConfirmCrossoverProfileBody,
  CreateCrossoverSwipeBody, UndoCrossoverSwipeBody,
} from "@workspace/api-zod";
import { DeckActionError, DeckStore } from "../lib/deck-store";

const router: IRouter = Router();
const store = new DeckStore();
function check<T extends { success: boolean }>(parsed: T): asserts parsed is T & { success: true } {
  if (!parsed.success) throw new DeckActionError(400, "invalid_action", "Please check your details and try again.");
}
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
