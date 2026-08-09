import Parser from "rss-parser";

import { canonicalizeUrl, stableNewsId, stripHtml } from "./normalize.ts";
import type { NewsSource } from "./sources.ts";
import { newsDatasetSchema, type Category, type NewsDataset, type SourceHealth } from "./types.ts";

const HOUR_MS = 60 * 60 * 1000;
const MAX_ITEMS_PER_SOURCE = 5;
const RECENT_WINDOW_MS = 48 * HOUR_MS;
const STALE_WINDOW_MS = 7 * 24 * HOUR_MS;
const MAX_FEED_SUMMARY_CHARACTERS = 240;

export interface FeedCandidate {
  id: string;
  sourceId: string;
  sourceName: string;
  sourcePriority: number;
  defaultCategory: Category;
  originalTitle: string;
  summary: string;
  url: string;
  publishedAt: string;
  fetchedAt: string;
  language: string;
}

export interface SourceFetchResult {
  source: NewsSource;
  health: SourceHealth;
  candidates: FeedCandidate[];
}

export type FetchLike = (
  input: string,
  init?: RequestInit
) => Promise<Response>;

function health(
  source: NewsSource,
  now: Date,
  status: SourceHealth["status"],
  itemCount: number,
  message?: string
): SourceHealth {
  return {
    id: source.id,
    name: source.name,
    feedUrl: source.feedUrl,
    defaultCategory: source.defaultCategory,
    lastCheckedAt: now.toISOString(),
    status,
    itemCount,
    ...(message ? { message } : {})
  };
}

function feedSummary(value: string): string {
  const characters = Array.from(stripHtml(value));
  if (characters.length <= MAX_FEED_SUMMARY_CHARACTERS) {
    return characters.join("");
  }
  return `${characters.slice(0, MAX_FEED_SUMMARY_CHARACTERS - 1).join("")}…`;
}

export async function parseFeedXml(
  source: NewsSource,
  xml: string,
  now: Date
): Promise<SourceFetchResult> {
  const parser = new Parser();
  const feed = await parser.parseString(xml);
  const fetchedAt = now.toISOString();
  const validItems = feed.items
    .flatMap((item) => {
      const title = stripHtml(item.title ?? "");
      const link = item.link?.trim() ?? "";
      const rawDate = item.isoDate ?? item.pubDate ?? "";
      const timestamp = Date.parse(rawDate);

      if (
        !title ||
        !link ||
        !Number.isFinite(timestamp) ||
        timestamp > now.getTime()
      ) {
        return [];
      }

      try {
        const url = canonicalizeUrl(link);
        const summary = feedSummary(
          item.contentSnippet ?? item.content ?? item.summary ?? ""
        );
        return [
          {
            id: stableNewsId(url),
            sourceId: source.id,
            sourceName: source.name,
            sourcePriority: source.priority,
            defaultCategory: source.defaultCategory,
            originalTitle: title,
            summary,
            url,
            publishedAt: new Date(timestamp).toISOString(),
            fetchedAt,
            language: source.language
          } satisfies FeedCandidate
        ];
      } catch {
        return [];
      }
    })
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));

  if (validItems.length === 0) {
    return {
      source,
      health: health(source, now, "error", 0, "Feed contains no valid dated items"),
      candidates: []
    };
  }

  const newestTimestamp = Date.parse(validItems[0]!.publishedAt);
  if (now.getTime() - newestTimestamp > STALE_WINDOW_MS) {
    return {
      source,
      health: health(source, now, "stale", 0, "Newest item is older than seven days"),
      candidates: []
    };
  }

  const candidates = validItems
    .filter((item) => now.getTime() - Date.parse(item.publishedAt) <= RECENT_WINDOW_MS)
    .slice(0, MAX_ITEMS_PER_SOURCE);

  return {
    source,
    health: health(source, now, "ok", candidates.length),
    candidates
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchSource(
  source: NewsSource,
  options: {
    fetcher?: FetchLike;
    now?: Date;
    timeoutMs?: number;
    retryDelayMs?: number;
  } = {}
): Promise<SourceFetchResult> {
  const fetcher = options.fetcher ?? ((input, init) => fetch(input, init));
  const now = options.now ?? new Date();
  const timeoutMs = options.timeoutMs ?? 10_000;
  const retryDelayMs = options.retryDelayMs ?? 1_000;
  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetcher(source.feedUrl, {
        signal: controller.signal,
        headers: { "user-agent": "GitHubNewsDashboard/1.0" }
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await parseFeedXml(source, await response.text(), now);
    } catch (error) {
      lastError = error;
      if (attempt < 2 && retryDelayMs > 0) {
        await delay(retryDelayMs * 2 ** attempt);
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  const message = lastError instanceof Error ? lastError.message : "Unknown feed error";
  return {
    source,
    health: health(source, now, "error", 0, message),
    candidates: []
  };
}

export async function loadPreviousDataset(
  url: string,
  fetcher: FetchLike = (input, init) => fetch(input, init),
  timeoutMs = 10_000
): Promise<NewsDataset | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(url, {
      headers: { accept: "application/json" },
      signal: controller.signal
    });
    if (!response.ok) {
      return null;
    }
    return newsDatasetSchema.parse(await response.json());
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
