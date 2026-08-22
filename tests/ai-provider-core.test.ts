import { describe, expect, it } from "vitest";
import { assertProviderResponseStatus, parseFindingDraft, providerFindingDraftRequest, providerValidationRequest, validateAiProviderInput } from "../lib/ai-provider-core";

describe("optional AI provider core", () => {
  it("keeps secrets out of saved settings while validating an OpenAI configuration", () => {
    const { settings, apiKey } = validateAiProviderInput({ provider: "openai", model: "gpt-4o-mini", apiKey: "sample-key-12345" });
    expect(settings).toMatchObject({ provider: "openai", model: "gpt-4o-mini", endpoint: null });
    expect(Object.values(settings)).not.toContain(apiKey);
    expect(providerValidationRequest(settings, apiKey).url).toBe("https://api.openai.com/v1/models");
  });

  it("requires an HTTPS endpoint for compatible providers", () => {
    expect(() => validateAiProviderInput({ provider: "openai-compatible", model: "local-model", endpoint: "http://localhost:11434/v1", apiKey: "sample-key-12345" })).toThrow(/HTTPS/);
  });

  it("builds a bounded draft request and parses labeled provider output without storing prompt history", () => {
    const { settings, apiKey } = validateAiProviderInput({ provider: "openai", model: "gpt-4o-mini", apiKey: "sample-key-12345" });
    const request = providerFindingDraftRequest(settings, apiKey, { source: "mobsf", severity: "Medium", title: "", detail: "A non-sensitive note." });
    expect(request.url).toBe("https://api.openai.com/v1/chat/completions");
    expect(request.init.body).toContain("non-sensitive note");
    expect(parseFindingDraft("openai", { choices: [{ message: { content: "TITLE: Clear title\nDETAIL: Neutral detail" } }] })).toEqual({ title: "Clear title", detail: "Neutral detail" });
  });

  it("treats a sample-key connection as successful only for a successful provider status", () => {
    expect(() => assertProviderResponseStatus(200)).not.toThrow();
    expect(() => assertProviderResponseStatus(401)).toThrow(/rejected/i);
    expect(() => assertProviderResponseStatus(429)).toThrow(/429/);
  });
});
