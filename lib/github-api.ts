/**
 * GitHub REST API wrapper. Reads an optional user-managed PAT from secure local
 * storage and sends it only to api.github.com, enabling private-repo access.
 */
import { getGitHubPat } from "@/lib/github-auth";

const BASE = "https://api.github.com";

export interface GHRepo {
  id: number;
  full_name: string;
  name: string;
  owner: { login: string; avatar_url: string };
  description: string | null;
  html_url: string;
  stargazers_count: number;
  forks_count: number;
  language: string | null;
  topics: string[];
  default_branch: string;
  pushed_at: string;
  size: number;
  license: { spdx_id: string } | null;
  archived: boolean;
  visibility: string;
}

export interface GHRelease {
  id: number;
  tag_name: string;
  name: string | null;
  published_at: string;
  prerelease: boolean;
  draft: boolean;
  body: string | null;
  assets: { name: string; browser_download_url: string; size: number }[];
  tarball_url: string;
  zipball_url: string;
}

export interface GHBranch {
  name: string;
  commit: { sha: string };
  protected: boolean;
}

async function ghFetch<T>(path: string): Promise<T> {
  const token = await getGitHubPat();
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GitHub API ${res.status}: ${body.slice(0, 120)}`);
  }
  return res.json() as Promise<T>;
}

/** Search public repos. Returns up to `perPage` results. */
export async function searchRepos(query: string, perPage = 20): Promise<GHRepo[]> {
  if (!query.trim()) return [];
  const q = encodeURIComponent(query.trim());
  const data = await ghFetch<{ items: GHRepo[] }>(
    `/search/repositories?q=${q}&sort=stars&order=desc&per_page=${perPage}`,
  );
  return data.items;
}

/** Fetch a single repo by owner/name. */
export async function getRepo(fullName: string): Promise<GHRepo> {
  return ghFetch<GHRepo>(`/repos/${fullName}`);
}

/** List the latest releases for a repo (max 10). */
export async function listReleases(fullName: string): Promise<GHRelease[]> {
  return ghFetch<GHRelease[]>(`/repos/${fullName}/releases?per_page=10`);
}

/** List branches for a repo (max 30). */
export async function listBranches(fullName: string): Promise<GHBranch[]> {
  return ghFetch<GHBranch[]>(`/repos/${fullName}/branches?per_page=30`);
}

/** Format a byte count into a human-readable string. */
export function fmtBytes(kb: number): string {
  if (kb < 1024) return `${kb} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

/** Format an ISO date string into a short relative label. */
export function fmtRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30)  return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}
