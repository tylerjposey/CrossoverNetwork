import { pgTable, serial, text, jsonb, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
export const usageLog = pgTable("usage_log", {
  id: serial("id").primaryKey(),
  session_id: text("session_id").notNull(),
  input_text: text("input_text").notNull(),
  ai_output: jsonb("ai_output").$type<Record<string, unknown>>(),
  status: text("status", { enum: ["success", "error", "rate_limited", "invalid_input"] }).notNull(),
  is_sample: boolean("is_sample").notNull().default(false),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("usage_log_created_idx").on(t.created_at), index("usage_log_session_idx").on(t.session_id)]);
export const insertUsageLogSchema = createInsertSchema(usageLog).omit({ id: true });
export type UsageLog = typeof usageLog.$inferSelect;
