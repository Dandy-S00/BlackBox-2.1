import * as SecureStore from "expo-secure-store";

const PAT_KEY = "blackbox.github-pat.v1";

export interface GitHubTokenValidation {
  login: string;
  name: string | null;
  rateLimit: number | null;
  rateRemaining: number | null;
  rateResetAt: string | null;
}

export interface GitHubRateLimitResource {
  key: "core" | "search" | "graphql";
  label: string;
  limit: number;
  remaining: number;
  used: number;
  resetAt: string | null;
}

export interface GitHubTokenDiagnostics extends GitHubTokenValidation {
  scopes: string[];
  scopesAvailable: boolean;
  expiresAt: string | null;
  rateResources: GitHubRateLimitResource[];
  checkedAt: string;
}

/** Read the locally encrypted GitHub personal access token. Never log this value. */
export async function getGitHubPat(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(PAT_KEY);
  } catch {
    return null;
  }
}

/** Store a trimmed personal access token using platform secure storage. */
export async function saveGitHubPat(token: string): Promise<void> {
  const clean = token.trim();
  if (!clean) throw new Error("Enter a GitHub personal access token.");
  await SecureStore.setItemAsync(PAT_KEY, clean, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

/** Delete the locally stored GitHub personal access token. */
export async function clearGitHubPat(): Promise<void> {
  await SecureStore.deleteItemAsync(PAT_KEY);
}

/** Check whether an encrypted GitHub token exists without exposing it to the UI. */
export async function hasGitHubPat(): Promise<boolean> {
  return Boolean(await getGitHubPat());
}

/**
 * Validate a supplied token with the minimal GitHub identity endpoint.
 * The token is used only for this request and is not persisted by this function.
 */
function authorizationHeaders(token: string) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token.trim()}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

function parseGitHubDate(value: string | null): string | null {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

/** Validate a supplied token and return GitHub-provided identity, permission, and rate-limit diagnostics. */
export async function getGitHubTokenDiagnostics(token: string): Promise<GitHubTokenDiagnostics> {
  const response = await fetch("https://api.github.com/user", {
    headers: authorizationHeaders(token),
  });

  if (!response.ok) {
    if (response.status === 401) throw new Error("GitHub rejected this token. Check it and try again.");
    if (response.status === 403) throw new Error("GitHub denied this token or its API limit is exhausted.");
    throw new Error(`GitHub could not validate this token (${response.status}).`);
  }

  const user = await response.json() as { login: string; name: string | null };
  const limit = Number(response.headers.get("x-ratelimit-limit"));
  const remaining = Number(response.headers.get("x-ratelimit-remaining"));
  const reset = Number(response.headers.get("x-ratelimit-reset"));
  const rawScopes = response.headers.get("x-oauth-scopes");
  const scopes = rawScopes ? rawScopes.split(",").map((scope) => scope.trim()).filter(Boolean) : [];
  const expiresAt = parseGitHubDate(response.headers.get("github-authentication-token-expiration"));

  let rateResources: GitHubRateLimitResource[] = [];
  try {
    const rateResponse = await fetch("https://api.github.com/rate_limit", { headers: authorizationHeaders(token) });
    if (rateResponse.ok) {
      const payload = await rateResponse.json() as {
        resources?: Record<string, { limit?: number; remaining?: number; used?: number; reset?: number }>;
      };
      rateResources = ([
        ["core", "Repository API"],
        ["search", "Search"],
        ["graphql", "GraphQL"],
      ] as const).flatMap(([key, label]) => {
        const entry = payload.resources?.[key];
        if (!entry || typeof entry.limit !== "number" || typeof entry.remaining !== "number") return [];
        return [{
          key,
          label,
          limit: entry.limit,
          remaining: entry.remaining,
          used: typeof entry.used === "number" ? entry.used : Math.max(0, entry.limit - entry.remaining),
          resetAt: typeof entry.reset === "number" ? new Date(entry.reset * 1000).toISOString() : null,
        }];
      });
    }
  } catch {
    // Keep the identity response diagnostics even if the rate endpoint is unavailable.
  }

  return {
    login: user.login,
    name: user.name ?? null,
    rateLimit: Number.isFinite(limit) ? limit : null,
    rateRemaining: Number.isFinite(remaining) ? remaining : null,
    rateResetAt: Number.isFinite(reset) && reset > 0 ? new Date(reset * 1000).toISOString() : null,
    scopes,
    scopesAvailable: rawScopes !== null,
    expiresAt,
    rateResources,
    checkedAt: new Date().toISOString(),
  };
}

/** Validate a candidate token before saving it. */
export async function validateGitHubPat(token: string): Promise<GitHubTokenDiagnostics> {
  return getGitHubTokenDiagnostics(token);
}

/** Refresh diagnostics for the encrypted token currently stored on this device. */
export async function getActiveGitHubTokenDiagnostics(): Promise<GitHubTokenDiagnostics> {
  const token = await getGitHubPat();
  if (!token) throw new Error("No saved GitHub token is available on this device.");
  return getGitHubTokenDiagnostics(token);
}
