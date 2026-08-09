import type { NewsItem } from "./types.ts";
import { canonicalizeUrl, titleFingerprint } from "./identity.ts";

interface RetentionOptions {
  now: Date;
  retentionDays: number;
  maxItems: number;
}

export function mergeAndPruneItems(
  existing: NewsItem[],
  incoming: NewsItem[],
  options: RetentionOptions
): NewsItem[] {
  const cutoff =
    options.now.getTime() - options.retentionDays * 24 * 60 * 60 * 1000;
  const seenIds = new Set<string>();
  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();
  const prioritized = [
    ...incoming.filter((item) => item.aiStatus === "generated"),
    ...existing.filter((item) => item.aiStatus === "generated"),
    ...incoming.filter((item) => item.aiStatus === "fallback"),
    ...existing.filter((item) => item.aiStatus === "fallback")
  ];

  return prioritized
    .filter((item) => Date.parse(item.publishedAt) >= cutoff)
    .filter((item) => {
      const url = canonicalizeUrl(item.url);
      const title = titleFingerprint(item.originalTitle);
      if (
        seenIds.has(item.id) ||
        seenUrls.has(url) ||
        seenTitles.has(title)
      ) {
        return false;
      }
      seenIds.add(item.id);
      seenUrls.add(url);
      seenTitles.add(title);
      return true;
    })
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
    .slice(0, options.maxItems);
}

export function selectTopNews(items: NewsItem[], limit = 20): NewsItem[] {
  const newestFirst = [...items].sort(
    (a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)
  );
  const important = newestFirst.filter((item) => item.importance >= 4);
  const selectedIds = new Set(important.map((item) => item.id));
  const fill = newestFirst.filter((item) => !selectedIds.has(item.id));

  return [...important, ...fill].slice(0, limit);
}
