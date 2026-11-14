import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

// One reservation per logical build/rewrite, never per automatic retry.
export const aiRequests = pgTable("ai_requests", {
  id: uuid("id").primaryKey(),
  session_id: text("session_id").notNull(),
  // Text column (no DB constraint): adding a kind needs no migration.
  kind: text("kind", { enum: ["deck", "rewrite", "reply"] }).notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("ai_requests_created_idx").on(t.created_at),
  index("ai_requests_session_created_idx").on(t.session_id, t.created_at),
]);
export const insertAiRequestSchema = createInsertSchema(aiRequests);
export type AiRequest = typeof aiRequests.$inferSelect;
