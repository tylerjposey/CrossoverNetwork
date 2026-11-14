import type { MatchmakingResult } from "./matchmaking/validate";
import { normalize } from "./matchmaking/validate";

// Deterministic, AI-free narrowing of an existing deck. The server is the only
// place this runs, so swipe validation, progress and undo all agree with the UI.
export const DECK_FILTERS = ["all", "other_schools", "other_majors", "shared_interests", "similar_goals"] as const;
export type DeckFilter = (typeof DECK_FILTERS)[number];
export type Visitor = NonNullable<MatchmakingResult["visitor_profile"]>;
export type FilterPerson = { id: number; school: string; major: string; interests: string[]; career_goals: string };

// Words that appear in almost every goal and would make "similar" meaningless.
const STOP = new Set([
  "about", "after", "also", "and", "better", "build", "building", "career", "careers", "community", "create", "design",
  "develop", "every", "field", "from", "graduation", "help", "helping", "into", "just", "like", "love", "make", "making",
  "more", "people", "really", "some", "that", "their", "them", "then", "they", "things", "this", "through", "tools",
  "using", "want", "what", "when", "where", "which", "while", "with", "work", "working", "would", "your", "young",
]);
// Crude 5-letter stems: "healthcare"/"health", "accessible"/"accessibility".
export function goalStems(text: string): Set<string> {
  const words = text.toLowerCase().normalize("NFKD").match(/\p{L}+/gu) ?? [];
  return new Set(words.filter((w) => w.length >= 4 && !STOP.has(w)).map((w) => w.slice(0, 5)));
}

export function available(filter: DeckFilter, visitor: Visitor | null): boolean {
  if (filter === "all") return true;
  if (!visitor) return false;
  if (filter === "other_schools") return !!visitor.school?.trim();
  if (filter === "other_majors") return !!visitor.major?.trim();
  if (filter === "shared_interests") return visitor.interests.some((i) => i.trim());
  return goalStems(visitor.career_goals).size > 0;
}

export function matchesFilter(filter: DeckFilter, visitor: Visitor | null, person: FilterPerson): boolean {
  if (filter === "all") return true;
  if (!visitor || !available(filter, visitor)) return false;
  if (filter === "other_schools") return normalize(person.school) !== normalize(visitor.school!);
  if (filter === "other_majors") return normalize(person.major) !== normalize(visitor.major!);
  if (filter === "shared_interests") {
    const mine = new Set(visitor.interests.map((i) => i.trim().toLowerCase()));
    return person.interests.some((i) => mine.has(i.trim().toLowerCase()));
  }
  const mine = goalStems(visitor.career_goals);
  return [...goalStems(person.career_goals)].some((s) => mine.has(s));
}

export function parseFilter(value: unknown, deckId: string | null): DeckFilter {
  if (!value || typeof value !== "object" || !deckId) return "all";
  const saved = value as { deck_id?: unknown; filter?: unknown };
  return saved.deck_id === deckId && DECK_FILTERS.includes(saved.filter as DeckFilter) ? saved.filter as DeckFilter : "all";
}

export function deckView(order: number[], requested: DeckFilter, visitor: Visitor | null, people: FilterPerson[], swiped: Set<number>) {
  const byId = new Map(people.map((p) => [p.id, p]));
  const members = (filter: DeckFilter) => order.filter((id) => {
    const person = byId.get(id);
    return filter === "all" || (!!person && matchesFilter(filter, visitor, person));
  });
  const options = DECK_FILTERS.map((id) => {
    const ok = available(id, visitor);
    const list = ok ? members(id) : [];
    return { id, available: ok, count: list.length, remaining: list.filter((pid) => !swiped.has(pid)).length };
  });
  // A filter that became unavailable (e.g. the visitor removed their school)
  // silently falls back to the whole deck instead of hiding everything.
  const filter = available(requested, visitor) ? requested : "all";
  return { filter, visible: members(filter), options };
}
