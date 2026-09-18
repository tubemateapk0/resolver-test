import { cacheTtlMs, streamedOrigin } from "../config/site.js";
import { sourceRank } from "../config/sources.js";
import type { Match, Sport, StreamLink } from "../types/models.js";
import { httpHeaders } from "./headers.js";

type CacheEntry<T> = { data: T; time: number };

const cache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.time > cacheTtlMs) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, time: Date.now() });
  if (cache.size > 1000) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
}

async function getJson<T>(path: string): Promise<T> {
  const cached = getCached<T>(path);
  if (cached) return cached;

  const res = await fetch(`${streamedOrigin}${path}`, {
    headers: httpHeaders(undefined, { Accept: "application/json" }),
  });
  if (!res.ok) throw new Error(`streamed.pk ${path} ${res.status}`);
  const data = (await res.json()) as T;
  setCache(path, data);
  return data;
}

export function listSports(): Promise<Sport[]> {
  return getJson("/api/sports");
}

export function listStreams(source: string, id: string): Promise<StreamLink[]> {
  return getJson(`/api/stream/${encodeURIComponent(source)}/${encodeURIComponent(id)}`);
}

async function matchHasStreams(match: Match): Promise<boolean> {
  const groups = await Promise.all(match.sources.map((src) => listStreams(src.source, src.id)));
  return groups.some((links) => links.length > 0);
}

export async function listMatches(sport: string, scope: "live" | "popular" | "all" = "live"): Promise<Match[]> {
  if (scope === "popular") return getJson(`/api/matches/${encodeURIComponent(sport)}/popular`);
  if (scope === "all") return getJson(`/api/matches/${encodeURIComponent(sport)}`);
  const live = await getJson<Match[]>("/api/matches/live");
  const scoped = !sport || sport === "all" ? live : live.filter((match) => match.category === sport);
  const flags = await Promise.all(scoped.map(matchHasStreams));
  return scoped.filter((_, index) => flags[index]);
}

export function listLivePopular(): Promise<Match[]> {
  return getJson("/api/matches/live/popular");
}

export async function findMatch(matchId: string): Promise<Match> {
  const live = await getJson<Match[]>("/api/matches/live");
  const fromLive = live.find((item) => item.id === matchId);
  if (fromLive) return fromLive;
  const all = await getJson<Match[]>("/api/matches/all");
  const match = all.find((item) => item.id === matchId);
  if (!match) throw new Error(`match not found: ${matchId}`);
  return match;
}

export async function listMatchStreams(match: Match): Promise<StreamLink[]> {
  const groups = await Promise.all(match.sources.map((src) => listStreams(src.source, src.id)));
  return groups
    .flat()
    .filter((link) => link.source && link.id)
    .sort(
      (a, b) => sourceRank(a.source) - sourceRank(b.source) || Number(b.hd) - Number(a.hd) || a.streamNo - b.streamNo,
    );
}

export function clearCache(): void {
  cache.clear();
}
