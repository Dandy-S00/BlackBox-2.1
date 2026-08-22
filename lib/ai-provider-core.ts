export type AiProviderId = "openai" | "anthropic" | "openai-compatible";

export interface AiProviderSettings {
  provider: AiProviderId;
  model: string;
  endpoint: string | null;
  updatedAt: string;
}

export interface AiProviderInput {
  provider: AiProviderId;
  model: string;
  endpoint?: string;
  apiKey: string;
}

export interface FindingDraftInput {
  source: string;
  severity: string;
  title: string;
  detail: string;
}

export interface FindingDraft {
  title: string;
  detail: string;
}

export const AI_PROVIDER_OPTIONS: Array<{ id: AiProviderId; label: string; description: string; defaultModel: string }> = [
  { id: "openai", label: "OpenAI", description: "Uses the OpenAI Chat Completions API.", defaultModel: "gpt-4o-mini" },
  { id: "anthropic", label: "Anthropic", description: "Uses the Anthropic Messages API.", defaultModel: "claude-3-5-haiku-latest" },
  { id: "openai-compatible", label: "OpenAI-compatible", description: "Uses an HTTPS endpoint implementing Chat Completions.", defaultModel: "your-model-id" },
];

const providerById = (id: AiProviderId) => AI_PROVIDER_OPTIONS.find((provider) => provider.id === id);

export function normalizeCompatibleEndpoint(value: string): string {
  const raw = value.trim().replace(/\/+$/, "");
  if (!raw) throw new Error("Enter the HTTPS API base URL for the compatible provider.");
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error("Enter a valid HTTPS API base URL."); }
  if (url.protocol !== "https:" || !url.hostname) throw new Error("The provider API base URL must use HTTPS.");
  if (url.username || url.password || url.search || url.hash) throw new Error("Use a clean HTTPS API base URL without credentials, query parameters, or fragments.");
  return url.toString().replace(/\/+$/, "");
}

export function validateAiProviderInput(input: AiProviderInput): { settings: AiProviderSettings; apiKey: string } {
  if (!providerById(input.provider)) throw new Error("Choose a supported AI provider.");
  const apiKey = input.apiKey.trim();
  if (apiKey.length < 8) throw new Error("Enter a valid provider API key before testing the connection.");
  const model = input.model.trim();
  if (!model || model.length > 120) throw new Error("Enter a provider model name of up to 120 characters.");
  const endpoint = input.provider === "openai-compatible" ? normalizeCompatibleEndpoint(input.endpoint ?? "") : null;
  return { settings: { provider: input.provider, model, endpoint, updatedAt: new Date().toISOString() }, apiKey };
}

export function providerBaseUrl(settings: Pick<AiProviderSettings, "provider" | "endpoint">): string {
  if (settings.provider === "openai") return "https://api.openai.com/v1";
  if (settings.provider === "anthropic") return "https://api.anthropic.com/v1";
  if (!settings.endpoint) throw new Error("The compatible provider endpoint is not configured.");
  return settings.endpoint;
}

export function providerValidationRequest(settings: Pick<AiProviderSettings, "provider" | "endpoint">, apiKey: string): { url: string; init: RequestInit } {
  const baseUrl = providerBaseUrl(settings);
  if (settings.provider === "anthropic") {
    return { url: `${baseUrl}/models?limit=1`, init: { headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" } } };
  }
  return { url: `${baseUrl}/models`, init: { headers: { Authorization: `Bearer ${apiKey}` } } };
}

export function assertProviderResponseStatus(status: number, purpose: "connection" | "draft" = "connection") {
  const noun = purpose === "connection" ? "provider connection test" : "provider draft request";
  if (status >= 200 && status < 300) return;
  if (status === 401 || status === 403) throw new Error("The provider rejected this API key or the key lacks access to this endpoint.");
  throw new Error(`The ${noun} returned ${status}.`);
}

function sourcePrompt(input: FindingDraftInput) {
  return `Create a concise draft for a security-review finding. Use only the provided non-sensitive notes. Do not claim verification, do not invent evidence, and do not include credentials or exploit steps. Return exactly two labeled lines:\nTITLE: <concise title>\nDETAIL: <brief neutral supporting note>\n\nSOURCE MODULE: ${input.source}\nSEVERITY: ${input.severity}\nEXISTING TITLE: ${input.title || "None"}\nNON-SENSITIVE NOTE: ${input.detail || "None"}`;
}

export function providerFindingDraftRequest(settings: Pick<AiProviderSettings, "provider" | "model" | "endpoint">, apiKey: string, input: FindingDraftInput): { url: string; init: RequestInit } {
  const baseUrl = providerBaseUrl(settings);
  const prompt = sourcePrompt(input);
  if (settings.provider === "anthropic") {
    return {
      url: `${baseUrl}/messages`,
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" } as Record<string, string>,
        body: JSON.stringify({ model: settings.model, max_tokens: 240, messages: [{ role: "user", content: prompt }] }),
      },
    };
  }
  return {
    url: `${baseUrl}/chat/completions`,
    init: {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` } as Record<string, string>,
      body: JSON.stringify({ model: settings.model, temperature: 0.2, max_tokens: 240, messages: [{ role: "user", content: prompt }] }),
    },
  };
}

function labeledValue(text: string, label: "TITLE" | "DETAIL") {
  const match = text.match(new RegExp(`(?:^|\\n)${label}:\\s*(.+)`, "i"));
  return match?.[1]?.trim() ?? "";
}

export function parseFindingDraft(provider: AiProviderId, payload: unknown): FindingDraft {
  const record = payload as { choices?: Array<{ message?: { content?: unknown } }>; content?: Array<{ type?: string; text?: unknown }> };
  const text = provider === "anthropic"
    ? record.content?.filter((part) => part.type === "text").map((part) => typeof part.text === "string" ? part.text : "").join("\n") ?? ""
    : typeof record.choices?.[0]?.message?.content === "string" ? record.choices[0].message.content : "";
  const title = labeledValue(text, "TITLE");
  const detail = labeledValue(text, "DETAIL");
  if (!title && !detail) throw new Error("The provider did not return a usable labeled draft. Keep the original finding and try again.");
  return { title, detail };
}
