import Anthropic from "@anthropic-ai/sdk";
import { ANTHROPIC_MODEL } from "./config";

export type ProviderRequest = {
  system: string; user: string; maxTokens: number; timeoutMs: number; signal: AbortSignal;
};
export type ProviderReply = { text: string; stopReason: string | null };
export type AiProvider = (request: ProviderRequest) => Promise<ProviderReply>;

// Inject the SDK client for isolated transport tests without replacing or
// reading the real credential. Production still uses the direct SDK below.
export function providerForClient(client: Anthropic): AiProvider {
  return async (request) => {
    const response = await client.messages.create({
      model: ANTHROPIC_MODEL, max_tokens: request.maxTokens,
      thinking: { type: "disabled" },
      system: request.system, messages: [{ role: "user", content: request.user }],
    }, { timeout: request.timeoutMs, signal: request.signal, maxRetries: 0 });
    return {
      text: response.content.filter((block) => block.type === "text").map((block) => block.text).join(""),
      stopReason: response.stop_reason,
    };
  };
}

// No client-side imports. Deliberately use the official direct endpoint and
// disable SDK retries; service.ts owns the only permitted automatic retry.
export const anthropicProvider: AiProvider = async (request) => {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("Anthropic server credential is not configured");
  const client = new Anthropic({ apiKey: key, baseURL: "https://api.anthropic.com", maxRetries: 0 });
  return providerForClient(client)(request);
};
