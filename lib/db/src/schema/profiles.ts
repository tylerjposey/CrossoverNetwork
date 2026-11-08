import { pgTable, serial, text, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
export const profiles = pgTable("profiles", {
  id: serial("id").primaryKey(),
  first_name: text("first_name").notNull(),
  school: text("school").notNull(),
  major: text("major").notNull(),
  year: text("year").notNull(),
  headline: text("headline").notNull(),
  career_goals: text("career_goals").notNull(),
  interests: text("interests").array().notNull(),
  ask_me_about: text("ask_me_about").notNull(),
  is_sample: boolean("is_sample").notNull().default(true),
});
export const insertProfileSchema = createInsertSchema(profiles).omit({ id: true });
export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
