import { pgTable, serial, text, integer, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { profiles } from "./profiles";
export const swipes = pgTable("swipes", {
  id: serial("id").primaryKey(),
  session_id: text("session_id").notNull(),
  profile_id: integer("profile_id").notNull().references(() => profiles.id),
  direction: text("direction", { enum: ["left", "right", "super"] }).notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("swipes_session_idx").on(t.session_id)]);
export const insertSwipeSchema = createInsertSchema(swipes).omit({ id: true, created_at: true });
export type Swipe = typeof swipes.$inferSelect;
