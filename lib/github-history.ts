import AsyncStorage from "@react-native-async-storage/async-storage";
import type { GHRepo } from "@/lib/github-api";

const HISTORY_KEY = "blackbox.github-recent-repos.v1";
const MAX_ENTRIES = 20;

export interface RecentGitHubRepo {
  fullName: string;
  name: string;
  description: string | null;
  htmlUrl: string;
  language: string | null;
  stars: number;
  forks: number;
  defaultBranch: string;
  pushedAt: string;
  lastAccessedAt: string;
}

function normalizeRepo(repo: GHRepo): RecentGitHubRepo {
  return {
    fullName: repo.full_name,
    name: repo.name,
    description: repo.description,
    htmlUrl: repo.html_url,
    language: repo.language,
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    defaultBranch: repo.default_branch,
    pushedAt: repo.pushed_at,
    lastAccessedAt: new Date().toISOString(),
  };
}

/** Read the recent repository list. Invalid or missing values return an empty list. */
export async function getRecentGitHubRepos(): Promise<RecentGitHubRepo[]> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((item): item is RecentGitHubRepo => typeof item?.fullName === "string")
      : [];
  } catch {
    return [];
  }
}

/** Record a repository at the front of the history, keeping only the newest 20 unique entries. */
export async function recordRecentGitHubRepo(repo: GHRepo): Promise<RecentGitHubRepo[]> {
  const entry = normalizeRepo(repo);
  const existing = await getRecentGitHubRepos();
  const next = [entry, ...existing.filter((item) => item.fullName !== entry.fullName)].slice(0, MAX_ENTRIES);
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  return next;
}

/** Delete all locally stored repository history. */
export async function clearRecentGitHubRepos(): Promise<void> {
  await AsyncStorage.removeItem(HISTORY_KEY);
}
