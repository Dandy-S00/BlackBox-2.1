import * as SecureStore from "expo-secure-store";
import type { GatewayDispatchInput } from "@/server/gateway";
import type { ModuleId } from "@/lib/workspace-model";
import { normalizeGatewayEndpoint } from "./gateway-endpoint";
import { validateConfirmationPin, validateProfileName } from "./gateway-profile-validation";

export { normalizeGatewayEndpoint } from "./gateway-endpoint";
export { validateConfirmationPin, validateProfileName } from "./gateway-profile-validation";

const PROFILE_INDEX_KEY = "blackbox.gateway-profiles.v2";
const ACTIVE_PROFILE_KEY = "blackbox.gateway-active-profile.v2";
const LEGACY_ENDPOINT_KEY = "blackbox.gateway-endpoint.v1";
const LEGACY_TOKEN_KEY = "blackbox.gateway-token.v1";

export interface GatewayProfile {
  id: string;
  name: string;
  endpoint: string;
  createdAt: string;
  updatedAt: string;
  hasConfirmationPin: boolean;
}

export interface GatewayCredentials { endpoint: string; token: string; }
export interface GatewayProfileInput extends GatewayCredentials { name: string; confirmationPin: string; }
export interface GatewayConnectionStatus {
  profileId: string;
  profileName: string;
  endpoint: string;
  endpointHost: string;
  connectedAt: string;
  health: "Healthy" | "Degraded";
  modules: Array<{ id: ModuleId; status: "healthy" | "unavailable" | "manual" }>;
}

type GatewayHealthPayload = { status?: unknown; modules?: unknown };
type GatewayHealthResult = Omit<GatewayConnectionStatus, "profileId" | "profileName">;

const tokenKey = (id: string) => `blackbox.gateway-profile-token.${id}`;
const pinKey = (id: string) => `blackbox.gateway-profile-pin.${id}`;
const profileId = () => `gateway-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

function headers(token: string) { return { Authorization: `Bearer ${token.trim()}`, Accept: "application/json" }; }

function parseModules(value: unknown): GatewayConnectionStatus["modules"] {
  if (!Array.isArray(value)) return [];
  const validIds = new Set<ModuleId>(["ghidra", "mobsf", "frida", "filesystem", "git", "sqlite"]);
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const candidate = entry as { id?: unknown; status?: unknown };
    if (!validIds.has(candidate.id as ModuleId)) return [];
    if (candidate.status !== "healthy" && candidate.status !== "unavailable" && candidate.status !== "manual") return [];
    return [{ id: candidate.id as ModuleId, status: candidate.status }];
  });
}

async function readProfileIndex(): Promise<GatewayProfile[]> {
  try {
    const raw = await SecureStore.getItemAsync(PROFILE_INDEX_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is GatewayProfile => Boolean(entry && typeof entry.id === "string" && typeof entry.name === "string" && typeof entry.endpoint === "string"));
  } catch { return []; }
}

async function writeProfileIndex(profiles: GatewayProfile[]): Promise<void> {
  await SecureStore.setItemAsync(PROFILE_INDEX_KEY, JSON.stringify(profiles), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
}

async function migrateLegacyProfile(): Promise<void> {
  const profiles = await readProfileIndex();
  if (profiles.length) return;
  try {
    const [endpoint, token] = await Promise.all([SecureStore.getItemAsync(LEGACY_ENDPOINT_KEY), SecureStore.getItemAsync(LEGACY_TOKEN_KEY)]);
    if (!endpoint || !token) return;
    const now = new Date().toISOString();
    const imported: GatewayProfile = { id: profileId(), name: "Imported gateway", endpoint: normalizeGatewayEndpoint(endpoint), createdAt: now, updatedAt: now, hasConfirmationPin: false };
    await SecureStore.setItemAsync(tokenKey(imported.id), token, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
    await writeProfileIndex([imported]);
    await SecureStore.setItemAsync(ACTIVE_PROFILE_KEY, imported.id, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
    await Promise.all([SecureStore.deleteItemAsync(LEGACY_ENDPOINT_KEY), SecureStore.deleteItemAsync(LEGACY_TOKEN_KEY)]);
  } catch { /* Preserve legacy credentials if migration cannot complete. */ }
}

export async function listGatewayProfiles(): Promise<GatewayProfile[]> {
  await migrateLegacyProfile();
  return readProfileIndex();
}

export async function getActiveGatewayProfile(): Promise<GatewayProfile | null> {
  const [profiles, activeId] = await Promise.all([listGatewayProfiles(), SecureStore.getItemAsync(ACTIVE_PROFILE_KEY)]);
  return profiles.find((profile) => profile.id === activeId) ?? null;
}

export async function activateGatewayProfile(id: string): Promise<GatewayProfile> {
  const profiles = await listGatewayProfiles();
  const profile = profiles.find((candidate) => candidate.id === id);
  if (!profile) throw new Error("That gateway profile is no longer available.");
  await SecureStore.setItemAsync(ACTIVE_PROFILE_KEY, profile.id, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  return profile;
}

/** Validate candidate operator credentials with the gateway health endpoint without persisting them. */
export async function testGatewayConnection(input: GatewayCredentials): Promise<GatewayHealthResult> {
  const endpoint = normalizeGatewayEndpoint(input.endpoint);
  const token = input.token.trim();
  if (!token) throw new Error("Enter the operator access token issued for this gateway.");
  const response = await fetch(`${endpoint}/v1/health`, { headers: headers(token), signal: AbortSignal.timeout(8_000) }).catch(() => null);
  if (!response) throw new Error("The gateway could not be reached. Check the HTTPS address and network access.");
  if (response.status === 401 || response.status === 403) throw new Error("The gateway rejected this access token. Check the token and try again.");
  if (!response.ok) throw new Error(`The gateway returned ${response.status}. Check its health and access policy.`);
  const payload = await response.json().catch(() => null) as GatewayHealthPayload | null;
  if (!payload || (payload.status !== "Healthy" && payload.status !== "Degraded")) throw new Error("The endpoint did not return a compatible gateway health response.");
  return { endpoint, endpointHost: new URL(endpoint).host, connectedAt: new Date().toISOString(), health: payload.status, modules: parseModules(payload.modules) };
}

/** Save a tested profile, its token, and its confirmation PIN encrypted on this device, then make it active. */
export async function saveGatewayProfile(input: GatewayProfileInput, tested: GatewayHealthResult): Promise<GatewayConnectionStatus> {
  const name = validateProfileName(input.name);
  const pin = validateConfirmationPin(input.confirmationPin);
  const id = profileId();
  const now = new Date().toISOString();
  const profile: GatewayProfile = { id, name, endpoint: tested.endpoint, createdAt: now, updatedAt: now, hasConfirmationPin: true };
  const profiles = await listGatewayProfiles();
  if (profiles.some((existing) => existing.name.toLowerCase() === name.toLowerCase())) throw new Error("A gateway profile already uses that name. Choose a different name.");
  await Promise.all([
    SecureStore.setItemAsync(tokenKey(id), input.token.trim(), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }),
    SecureStore.setItemAsync(pinKey(id), pin, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }),
    writeProfileIndex([profile, ...profiles]),
    SecureStore.setItemAsync(ACTIVE_PROFILE_KEY, id, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }),
  ]);
  return { ...tested, profileId: id, profileName: name };
}

export async function setGatewayProfilePin(id: string, pin: string): Promise<void> {
  const clean = validateConfirmationPin(pin);
  const profiles = await listGatewayProfiles();
  const profile = profiles.find((candidate) => candidate.id === id);
  if (!profile) throw new Error("That gateway profile is no longer available.");
  await SecureStore.setItemAsync(pinKey(id), clean, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  await writeProfileIndex(profiles.map((candidate) => candidate.id === id ? { ...candidate, hasConfirmationPin: true, updatedAt: new Date().toISOString() } : candidate));
}

export async function removeGatewayProfile(id: string): Promise<void> {
  const profiles = await listGatewayProfiles();
  const remaining = profiles.filter((profile) => profile.id !== id);
  await Promise.all([
    SecureStore.deleteItemAsync(tokenKey(id)),
    SecureStore.deleteItemAsync(pinKey(id)),
    writeProfileIndex(remaining),
  ]);
  const activeId = await SecureStore.getItemAsync(ACTIVE_PROFILE_KEY);
  if (activeId === id) {
    if (remaining[0]) await SecureStore.setItemAsync(ACTIVE_PROFILE_KEY, remaining[0].id, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
    else await SecureStore.deleteItemAsync(ACTIVE_PROFILE_KEY);
  }
}

async function getActiveCredentials(): Promise<{ profile: GatewayProfile; token: string }> {
  const profile = await getActiveGatewayProfile();
  if (!profile) throw new Error("No gateway profile is active on this device.");
  const token = await SecureStore.getItemAsync(tokenKey(profile.id));
  if (!token) throw new Error("The active gateway profile is missing its operator token. Reconnect or remove it.");
  return { profile, token };
}

export async function refreshActiveGatewayConnection(): Promise<GatewayConnectionStatus> {
  const { profile, token } = await getActiveCredentials();
  const result = await testGatewayConnection({ endpoint: profile.endpoint, token });
  return { ...result, profileId: profile.id, profileName: profile.name };
}

export async function verifyActiveGatewayPin(pin: string): Promise<void> {
  const { profile } = await getActiveCredentials();
  const expected = await SecureStore.getItemAsync(pinKey(profile.id));
  if (!expected || !profile.hasConfirmationPin) throw new Error("This profile has no confirmation PIN. Set one before dispatching.");
  if (expected !== pin.trim()) throw new Error("The gateway confirmation PIN is incorrect.");
}

/** Dispatch only after the UI has verified the active profile’s confirmation PIN and explicit authorization. */
export async function dispatchToActiveGateway(input: GatewayDispatchInput): Promise<{ receiptId: string; status: string }> {
  const { profile, token } = await getActiveCredentials();
  const response = await fetch(`${normalizeGatewayEndpoint(profile.endpoint)}/v1/jobs`, {
    method: "POST",
    headers: { ...headers(token), "Content-Type": "application/json", "Idempotency-Key": input.jobId },
    body: JSON.stringify({ jobId: input.jobId, reference: input.reference, targetType: input.targetType, modules: input.modules, approvedAt: input.approvedAt }),
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);
  if (!response) throw new Error("The gateway could not be reached while starting this test.");
  if (response.status === 401 || response.status === 403) throw new Error("Gateway access was denied. Switch or reconnect a valid operator profile.");
  if (!response.ok) throw new Error(`The gateway declined this test (${response.status}).`);
  const payload = await response.json().catch(() => ({})) as { receiptId?: unknown; status?: unknown };
  return { receiptId: typeof payload.receiptId === "string" ? payload.receiptId : input.jobId, status: typeof payload.status === "string" ? payload.status : "Accepted" };
}

/** Legacy compatibility for existing callers: remove every locally stored profile. */
export async function clearGatewayConnection(): Promise<void> {
  const profiles = await listGatewayProfiles();
  await Promise.all(profiles.map((profile) => removeGatewayProfile(profile.id)));
}
