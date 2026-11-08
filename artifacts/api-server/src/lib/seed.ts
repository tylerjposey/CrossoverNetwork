import { db, profiles, usageLog } from "@workspace/db";
import { sql } from "drizzle-orm";
import { sampleProfiles } from "./sample-profiles";
import { logger } from "./logger";

const scenarios = [
  ["Alex", "SJSU", "MIS", "health technology", "Bouldering", "Cooking"],
  ["Sam", "UC Davis", "Environmental Science", "clean energy policy", "Hiking", "Gardening"],
  ["Morgan", "UCLA", "Psychology", "accessible education", "Reading", "Gaming"],
  ["Taylor", "Howard", "Communications", "public health storytelling", "Podcasts", "Dance"],
  ["Casey", "NYU", "Finance", "financial inclusion", "Chess", "Cooking"],
  ["Jamie", "De Anza", "Graphic Design", "inclusive product design", "Drawing", "Thrifting"],
  ["Drew", "Arizona State", "Mechanical Engineering", "sustainable transportation", "Cycling", "Camping"],
  ["Robin", "Santa Clara", "Nursing", "digital mental health", "Yoga", "Reading"],
  ["Avery", "University of Texas", "Marketing", "sustainable community brands", "Photography", "Indie music"],
  ["Sky", "Oregon State", "Computer Science", "adaptive fitness tools", "Basketball", "Gaming"],
] as const;

// A transaction-scoped lock prevents duplicate seeds across server instances.
// DML only: production schema is applied by Replit's Publish flow.
export async function seedIfEmpty(): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(87309121)`);
    if (!(await tx.select({ id: profiles.id }).from(profiles).limit(1)).length) {
      await tx.insert(profiles).values(sampleProfiles);
      logger.info("Seeded 30 fictional sample profiles");
    }
    if ((await tx.select({ id: usageLog.id }).from(usageLog).limit(1)).length) return;
    const all = await tx.select().from(profiles).orderBy(profiles.id);
    await tx.insert(usageLog).values(scenarios.map(([name, school, major, goal, interest, secondInterest], i) => {
      const ranked = [...all].sort((a, b) =>
        Number(b.interests.includes(interest)) - Number(a.interests.includes(interest)) || a.id - b.id).slice(0, 10);
      const wildcard = ranked.find((p) => p.major !== major) ?? ranked[0]!;
      return {
        session_id: `sample-${i + 1}`,
        input_text: `I'm ${name}, studying ${major} at ${school}. After graduation I want to work in ${goal}. Outside class, I enjoy ${interest.toLowerCase()} and ${secondInterest.toLowerCase()}. I'd love to meet people in other fields who could bring a different perspective to a project.`,
        ai_output: {
          visitor_profile: { first_name: name, school, major, year: "Student", career_goals: goal, interests: [interest, secondInterest] },
          matches: ranked.map((p, rank) => ({
            profile_id: p.id, match_score: 94 - rank * 3,
            why_connect: `Your interest in ${goal} and ${p.first_name}'s goal to ${p.career_goals.toLowerCase()} offer a useful cross-discipline conversation.`,
            icebreaker: `Hi ${p.first_name}! I'm exploring ${goal} and would love to hear about ${p.ask_me_about.charAt(0).toLowerCase() + p.ask_me_about.slice(1)}.`,
          })),
          career_tip: { field: wildcard.major, reason: `Explore ${wildcard.major} for a different perspective on ${goal}.`, profile_id: wildcard.id },
          insufficient_input: false,
        },
        status: "success" as const, is_sample: true,
        created_at: new Date(Date.now() - (i * 15 + 2) * 60 * 60 * 1000),
      };
    }));
    logger.info("Seeded 10 labeled sample usage records");
  });
}
