import { randomUUID } from "node:crypto";
import { ConnectionStore } from "../connection-store";
import { DeckActionError } from "../deck-store";
import { BuildCrossoverDeckBody, RewriteCrossoverIcebreakerBody } from "@workspace/api-zod";
import type { Profile } from "@workspace/db";
import { z } from "zod";
import { MatchmakingStore } from "./store";
import { anthropicProvider, type AiProvider, type ProviderReply } from "./provider";
import { validateResult, resultSchema } from "./validate";
import { hasUsefulInput, taggedData } from "./input";
import { MATCHMAKER_SYSTEM, REWRITE_SYSTEM } from "./prompt";
import {
  AI_BREAK_MESSAGE, ATTEMPT_TIMEOUT_MS, DECK_DEADLINE_MS, DECK_MAX_TOKENS,
  INPUT_MESSAGE, REWRITE_MAX_TOKENS, VISITOR_LIMIT_MESSAGE,
} from "./config";

export class AiActionError extends Error {
  constructor(readonly status: number, readonly code: "invalid_input" | "insufficient_input" | "visitor_limit" | "global_limit" | "ai_unavailable" | "invalid_profile", message: string) {
    super(message);
  }
}

// Accept only explicitly safe provider metadata; never log SDK request headers,
// the API key, visitor text, or entire SDK error objects.
function errorMetadata(error: unknown): Record<string, unknown> {
  const e = error && typeof error === "object" ? error as Record<string, unknown> : {};
  const detail = e.error && typeof e.error === "object" ? e.error as Record<string, unknown> : {};
  const nested = detail.error && typeof detail.error === "object" ? detail.error as Record<string, unknown> : detail;
  const safe = (value: unknown) => typeof value === "string"
    ? value.replace(/sk-ant-[^\s"']+/g, "[removed]").slice(0, 500) : undefined;
  return { name: safe(e.name), status: typeof e.status === "number" ? e.status : undefined,
    type: safe(nested.type), detail: safe(nested.message) ?? safe(e.message) };
}

export class MatchmakingService {
  constructor(
    readonly store = new MatchmakingStore(),
    readonly provider: AiProvider = anthropicProvider,
    readonly reportError: (metadata: Record<string, unknown>) => void = () => {},
    readonly deckDeadlineMs = DECK_DEADLINE_MS,
  ) {}

  private async call(system: string, user: string, maxTokens: number, deadline: number): Promise<ProviderReply> {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error("AI request deadline exceeded");
    const timeoutMs = Math.min(ATTEMPT_TIMEOUT_MS, remaining);
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        this.provider({ system, user, maxTokens, timeoutMs, signal: controller.signal }),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(new Error("AI request deadline exceeded"));
          }, timeoutMs);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private async reserve(sessionId: string, kind: "deck" | "rewrite", text: string): Promise<void> {
    const reservation = await this.store.reserve(sessionId, kind);
    if (!reservation.allowed) {
      await this.store.log(sessionId, text, "rate_limited", { kind, reason: reservation.reason });
      throw new AiActionError(429, reservation.reason,
        reservation.reason === "visitor_limit" ? VISITOR_LIMIT_MESSAGE : AI_BREAK_MESSAGE);
    }
  }

  async build(sessionId: string, body: unknown, people: Profile[]) {
    const deadline = Date.now() + this.deckDeadlineMs;
    const raw = body && typeof body === "object" && "input_text" in body && typeof body.input_text === "string"
      ? body.input_text : JSON.stringify(body) ?? "";
    // Keep even rejected text server-side so retry/refresh never loses it.
    await this.store.saveSession(sessionId, { input_text: raw });
    const parsed = BuildCrossoverDeckBody.strict().safeParse(body);
    const session = await this.store.session(sessionId);
    const saved = resultSchema.shape.visitor_profile.safeParse(session.edited_profile ?? null);
    const savedProfile = saved.success ? saved.data : null;
    const hasSavedProfile = !!savedProfile && !!(
      savedProfile.school || savedProfile.major || savedProfile.career_goals.trim() || savedProfile.interests.length
    );
    if (!parsed.success || (!hasSavedProfile && !hasUsefulInput(raw))) {
      await this.store.log(sessionId, raw, "invalid_input", { reason: INPUT_MESSAGE });
      throw new AiActionError(400, "invalid_input", INPUT_MESSAGE);
    }
    await this.reserve(sessionId, "deck", raw);
    let output: ReturnType<typeof validateResult>;
    try {
      const compact = people.map(({ id, first_name, school, major, year, career_goals, interests, ask_me_about }) =>
        ({ id, first_name, school, major, year, career_goals, interests, ask_me_about }));
      const user = [taggedData("visitor_text", parsed.data.input_text), taggedData("saved_profile", savedProfile),
        taggedData("profiles", compact)].join("\n");
      let correction = "";
      output = undefined as never;
      for (let attempt = 0; attempt < 2; attempt++) {
        const response = await this.call(MATCHMAKER_SYSTEM, user + correction, DECK_MAX_TOKENS, deadline);
        try {
          if (response.stopReason !== "end_turn") throw new Error(`Incomplete model response: ${response.stopReason}`);
          output = validateResult(response.text, people, raw + (savedProfile ? JSON.stringify(savedProfile) : ""));
          if (Date.now() >= deadline) throw new Error("AI request deadline exceeded");
          break;
        } catch (malformed) {
          if (attempt === 1 || Date.now() >= deadline) throw malformed;
          this.reportError({ stage: "retrying_invalid_output", ...errorMetadata(malformed) });
          correction = "\n" + taggedData("correction", "Previous output was incomplete or did not meet the schema, grounded IDs/facts, diversity or one-sentence requirements. Return a fresh compact valid JSON object.");
        }
      }
      if (output.insufficient_input) {
        await this.store.log(sessionId, raw, "invalid_input", output);
        throw new AiActionError(422, "insufficient_input", output.reason || INPUT_MESSAGE);
      }
      const usageId = await this.store.log(sessionId, raw, "success", output);
      const deckId = randomUUID();
      await this.store.saveSession(sessionId, {
        deck: output, deck_id: deckId, visitor_profile: output.visitor_profile,
        edited_profile: output.visitor_profile, profile_confirmed_deck_id: null,
      });
      return { usage_id: usageId, deck_id: deckId, remaining_builds: await this.store.remaining(sessionId), result: output };
    } catch (error) {
      if (error instanceof AiActionError) throw error;
      this.reportError({ stage: "deck_failed", ...errorMetadata(error) });
      await this.store.log(sessionId, raw, "error", { reason: AI_BREAK_MESSAGE });
      throw new AiActionError(503, "ai_unavailable", AI_BREAK_MESSAGE);
    }
  }

  async rewrite(sessionId: string, body: unknown, people: Profile[]) {
    const parsed = RewriteCrossoverIcebreakerBody.strict().safeParse(body);
    const session = await this.store.session(sessionId);
    const deck = resultSchema.safeParse(session.deck);
    const id = parsed.success ? parsed.data.profile_id : -1;
    const connections = new ConnectionStore(this.store.database);
    const connectionId = parsed.success ? parsed.data.connection_id : undefined;
    const connection = connectionId !== undefined ? await connections.get(sessionId, connectionId).catch((error) => {
      if (error instanceof DeckActionError) return undefined;
      throw error;
    }) : undefined;
    const match = connectionId !== undefined
      ? connection && connection.profile.id === id ? connection : undefined
      : deck.success ? deck.data.matches.find((m) => m.profile_id === id) : undefined;
    const person = people.find((p) => p.id === id);
    const text = `Rewrite icebreaker for profile ${id}`;
    if (!parsed.success || !match || !person) {
      await this.store.log(sessionId, text, "invalid_input", { kind: "rewrite", reason: "Choose a person from your current deck." });
      throw new AiActionError(400, "invalid_profile", "Choose a person from your current deck.");
    }
    await this.reserve(sessionId, "rewrite", text);
    try {
      const response = await this.call(REWRITE_SYSTEM, taggedData("rewrite_context", {
        visitor_profile: connection && connection.deck_id !== session.deck_id
          ? connection.visitor_profile : session.edited_profile ?? (deck.success ? deck.data.visitor_profile : null),
        person, why_connect: match.why_connect, previous_icebreaker: match.icebreaker,
      }), REWRITE_MAX_TOKENS, Date.now() + ATTEMPT_TIMEOUT_MS);
      if (response.stopReason !== "end_turn") throw new Error("Incomplete rewrite response");
      const draft = z.object({ icebreaker: z.string().trim().min(1).max(299) }).strict().parse(JSON.parse(response.text));
      await connections.persistDraft(sessionId, id, draft.icebreaker,
        connection?.deck_id ?? String(session.deck_id), connectionId);
      await this.store.log(sessionId, text, "success", { kind: "rewrite", profile_id: id, icebreaker: draft.icebreaker });
      return { profile_id: id, icebreaker: draft.icebreaker, remaining_builds: await this.store.remaining(sessionId), connection_id: connectionId ?? null };
    } catch (error) {
      this.reportError({ stage: "rewrite_failed", ...errorMetadata(error) });
      await this.store.log(sessionId, text, "error", { kind: "rewrite", reason: AI_BREAK_MESSAGE });
      if (error instanceof DeckActionError) {
        throw new AiActionError(400, "invalid_profile", "That connection changed. Refresh your Connections and try again.");
      }
      throw new AiActionError(503, "ai_unavailable", AI_BREAK_MESSAGE);
    }
  }
}
