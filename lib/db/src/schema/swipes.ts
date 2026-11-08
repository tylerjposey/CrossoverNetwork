import { pgTable, serial, text, integer, timestamp, index, jsonb, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { profiles } from "./profiles";
export const swipes = pgTable("swipes", {
  id: serial("id").primaryKey(),
  session_id: text("session_id").notNull(),
  profile_id: integer("profile_id").notNull().references(() => profiles.id),
  deck_id: text("deck_id"),
  match_snapshot: jsonb("match_snapshot").$type<Record<string, unknown>>(),
  direction: text("direction", { enum: ["left", "right", "super"] }).notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("swipes_session_idx").on(t.session_id),
  uniqueIndex("swipes_deck_profile_idx").on(t.session_id, t.deck_id, t.profile_id),
]);
export const insertSwipeSchema = createInsertSchema(swipes).omit({ id: true, created_at: true });
export type Swipe = typeof swipes.$inferSelect;
