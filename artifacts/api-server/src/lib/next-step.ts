// Deterministic "what to do next" for a saved connection. No AI: it only
// rephrases facts already on the fictional profile and the saved match.
export type NextStep = { kind: "coffee_chat" | "shared_interest" | "ask_about"; title: string; text: string };
type Input = {
  direction: "right" | "super";
  profile: { first_name: string; interests: string[]; ask_me_about: string };
  visitor_profile: { interests: string[] } | null;
};

function topic(askMeAbout: string): string {
  const t = askMeAbout.trim().replace(/[.!?]+$/, "");
  if (/^(my|our)\s/i.test(t)) return t.replace(/^(my|our)\s/i, "their ");
  return t.charAt(0).toLowerCase() + t.slice(1);
}

export function nextStep(c: Input): NextStep {
  const name = c.profile.first_name;
  const about = topic(c.profile.ask_me_about);
  const mine = new Set((c.visitor_profile?.interests ?? []).map((i) => i.trim().toLowerCase()));
  const shared = c.profile.interests.find((i) => mine.has(i.trim().toLowerCase()));
  if (c.direction === "super") {
    return { kind: "coffee_chat", title: "Ask for a 15-minute coffee chat",
      text: `After your opener, ask ${name} for a short virtual coffee about ${about}. Offer two times and keep it to 15 minutes.` };
  }
  if (shared) {
    return { kind: "shared_interest", title: `Open with ${shared}`,
      text: `You both list ${shared}. Lead with that, then ask ${name} about ${about}.` };
  }
  return { kind: "ask_about", title: "Ask about their project",
    text: `Ask ${name} to tell you about ${about}. One specific question shows you read their profile.` };
}
