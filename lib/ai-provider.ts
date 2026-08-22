import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import {
  type AiProviderInput,
  type AiProviderSettings,
  type FindingDraft,
  type FindingDraftInput,
  assertProviderResponseStatus,
  parseFindingDraft,
  providerFindingDraftRequest,
  providerValidationRequest,
  validateAiProviderInput,
} from "@/lib/ai-provider-core";

const SETTINGS_KEY = "blackbox.ai-provider-settings.v1";
const API_KEY = "blackbox.ai-provider-key.v1";

export async function getAiProviderSettings(): Promise<AiProviderSettings | null> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== "object" || typeof parsed.provider !== "string" || typeof parsed.model !== "string") return null;
    if (parsed.provider !== "openai" && parsed.provider !== "anthropic" && parsed.provider !== "openai-compatible") return null;
    return { provider: parsed.provider, model: parsed.model, endpoint: typeof parsed.endpoint === "string" ? parsed.endpoint : null, updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : "" };
  } catch { return null; }
}

async function getAiProviderKey() { try { return await SecureStore.getItemAsync(API_KEY); } catch { return null; } }

export async function hasAiProviderConfiguration() { return Boolean(await getAiProviderSettings()) && Boolean(await getAiProviderKey()); }

export async function validateAiProviderCandidate(input: AiProviderInput): Promise<AiProviderSettings> {
  const { settings, apiKey } = validateAiProviderInput(input);
  const request = providerValidationRequest(settings, apiKey);
  const response = await fetch(request.url, { ...request.init, signal: AbortSignal.timeout(10_000) }).catch(() => null);
  if (!response) throw new Error("The provider could not be reached. Check its endpoint and your network connection.");
  assertProviderResponseStatus(response.status);
  return settings;
}

export async function saveAiProviderConfiguration(input: AiProviderInput, settings: AiProviderSettings) {
  const { apiKey } = validateAiProviderInput(input);
  await Promise.all([
    SecureStore.setItemAsync(API_KEY, apiKey, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }),
    AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)),
  ]);
}

export async function clearAiProviderConfiguration() {
  await Promise.all([SecureStore.deleteItemAsync(API_KEY), AsyncStorage.removeItem(SETTINGS_KEY)]);
}

export async function validateSavedAiProvider() {
  const [settings, apiKey] = await Promise.all([getAiProviderSettings(), getAiProviderKey()]);
  if (!settings || !apiKey) throw new Error("No optional AI provider is configured on this device.");
  const request = providerValidationRequest(settings, apiKey);
  const response = await fetch(request.url, { ...request.init, signal: AbortSignal.timeout(10_000) }).catch(() => null);
  if (!response) throw new Error("The saved provider could not be reached.");
  assertProviderResponseStatus(response.status);
  return settings;
}

export async function draftFindingWithAi(input: FindingDraftInput): Promise<FindingDraft> {
  const [settings, apiKey] = await Promise.all([getAiProviderSettings(), getAiProviderKey()]);
  if (!settings || !apiKey) throw new Error("Configure an optional AI provider before requesting a draft.");
  const request = providerFindingDraftRequest(settings, apiKey, input);
  const response = await fetch(request.url, { ...request.init, signal: AbortSignal.timeout(20_000) }).catch(() => null);
  if (!response) throw new Error("The provider could not be reached while drafting.");
  assertProviderResponseStatus(response.status, "draft");
  return parseFindingDraft(settings.provider, await response.json().catch(() => null));
}
