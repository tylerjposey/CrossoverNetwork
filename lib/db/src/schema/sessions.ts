import { pgTable, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expires_at: timestamp("expires_at", { withTimezone: true }).notNull(),
}, (t) => [index("sessions_expiry_idx").on(t.expires_at)]);
export const insertSessionSchema = createInsertSchema(sessions);
export type Session = typeof sessions.$inferSelect;
