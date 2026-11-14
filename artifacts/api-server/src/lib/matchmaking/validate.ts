import { BuildCrossoverDeckResponse } from "@workspace/api-zod";
import type { Profile } from "@workspace/db";
import type { z } from "zod";

const generated = BuildCrossoverDeckResponse.shape.result;
export const resultSchema = generated.extend({
  visitor_profile: generated.shape.visitor_profile.options[0].strict().nullable(),
  matches: generated.shape.matches.element.strict().array().max(10),
  career_tip: generated.shape.career_tip.options[0].strict().nullable(),
}).strict();
export type MatchmakingResult = z.infer<typeof resultSchema>;

const aliases: Record<string, string> = {
  "san jose state university": "sjsu", "san jose state": "sjsu",
  "university of california los angeles": "ucla",
  "university of california berkeley": "uc berkeley",
  "management information systems": "mis",
  "computer science": "cs",
};
export const normalize = (value: string) => {
  let s = value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  for (const [long, short] of Object.entries(aliases)) s = s.replaceAll(long, short);
  return s.replace(/[^\p{L}\p{N}]+/gu, " ").trim();
};

export function validateResult(raw: string, people: Profile[], source: string): MatchmakingResult {
  const result = resultSchema.parse(JSON.parse(raw));
  if (result.insufficient_input) {
    if (!result.reason?.trim()) throw new Error("Missing insufficient-input explanation");
    if (result.matches.length || result.career_tip) throw new Error("Insufficient-input result cannot contain a deck");
    return result;
  }
  if (!result.visitor_profile || !result.career_tip || result.matches.length !== 10) throw new Error("Expected visitor, wildcard and 10 matches");
  const map = new Map(people.map((p) => [p.id, p]));
  // Invalid IDs are dropped, never replaced with fabricated or heuristic people.
  result.matches = result.matches.filter((m) => map.has(m.profile_id));
  if (result.matches.length !== 10 || new Set(result.matches.map((m) => m.profile_id)).size !== 10) {
    throw new Error("Unknown or duplicate profile IDs");
  }
  const sourceNormalized = ` ${normalize(source)} `;
  for (const key of ["first_name", "school", "major", "year"] as const) {
    const fact = result.visitor_profile[key];
    if (fact && !sourceNormalized.includes(` ${normalize(fact)} `)) throw new Error(`Visitor ${key} not grounded in supplied text`);
  }
  const visitor = result.visitor_profile;
  const selected = result.matches.map((m) => map.get(m.profile_id)!);
  if (visitor.school && selected.filter((p) => normalize(p.school) !== normalize(visitor.school!)).length < 4) throw new Error("School diversity failed");
  if (visitor.major && selected.filter((p) => normalize(p.major) !== normalize(visitor.major!)).length < 3) throw new Error("Major diversity failed");
  if (!result.matches.some((m) => m.profile_id === result.career_tip!.profile_id)) throw new Error("Wildcard absent from deck");
  if (normalize(map.get(result.career_tip.profile_id)!.major) !== normalize(result.career_tip.field)) throw new Error("Wildcard field not represented by profile");
  for (const match of result.matches) {
    if (/\n|[!?]\s+\S|\.\s+[A-Z]/.test(match.why_connect)) throw new Error("Why-connect must be one sentence");
    if (!match.icebreaker.trim()) throw new Error("Empty icebreaker");
  }
  result.matches.sort((a, b) => b.match_score - a.match_score);
  return result;
}
