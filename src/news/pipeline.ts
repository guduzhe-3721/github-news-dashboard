import { processCandidatesWithAi, type AIGenerator } from "./ai.ts";
import { mergeAndPruneItems } from "./dataset.ts";
import type { FeedCandidate, SourceFetchResult } from "./feeds.ts";
import { canonicalizeUrl, titleFingerprint } from "./identity.ts";
import { deduplicateCandidates } from "./normalize.ts";
import { newsDatasetSchema, type NewsDataset } from "./types.ts";

export function selectCandidatesForRun(
  sourceResults: SourceFetchResult[],
  limit = 30
): FeedCandidate[] {
  const deduplicated = deduplicateCandidates(
    sourceResults.flatMap((result) => result.candidates)
  );
  const queues = new Map<string, FeedCandidate[]>();
  for (const candidate of deduplicated) {
    const queue = queues.get(candidate.sourceId) ?? [];
    queue.push(candidate);
    queues.set(candidate.sourceId, queue);
  }

  const sourceOrder = [...queues.keys()].sort((left, right) => {
    const leftPriority = queues.get(left)?.[0]?.sourcePriority ?? Number.MAX_SAFE_INTEGER;
    const rightPriority = queues.get(right)?.[0]?.sourcePriority ?? Number.MAX_SAFE_INTEGER;
    return leftPriority - rightPriority;
  });
  const selected: FeedCandidate[] = [];

  while (selected.length < limit) {
    let added = false;
    for (const sourceId of sourceOrder) {
      const candidate = queues.get(sourceId)?.shift();
      if (candidate) {
        selected.push(candidate);
        added = true;
      }
      if (selected.length === limit) break;
    }
    if (!added) break;
  }

  return selected;
}

export async function buildNewsDataset(options: {
  sourceResults: SourceFetchResult[];
  previous: NewsDataset | null;
  now: Date;
  generate: AIGenerator;
}): Promise<NewsDataset> {
  if (options.sourceResults.every((result) => result.health.status === "error")) {
    throw new Error("No source completed successfully");
  }

  const historicalCutoff = options.now.getTime() - 30 * 24 * 60 * 60 * 1000;
  const retainedHistory = (options.previous?.items ?? []).filter(
    (item) => Date.parse(item.publishedAt) >= historicalCutoff
  );
  const knownIds = new Set(retainedHistory.map((item) => item.id));
  const knownUrls = new Set(retainedHistory.map((item) => canonicalizeUrl(item.url)));
  const knownTitles = new Set(
    retainedHistory.map((item) => titleFingerprint(item.originalTitle))
  );
  const candidates = selectCandidatesForRun(options.sourceResults, 30).filter(
    (candidate) =>
      !knownIds.has(candidate.id) &&
      !knownUrls.has(canonicalizeUrl(candidate.url)) &&
      !knownTitles.has(titleFingerprint(candidate.originalTitle))
  );
  const incoming = await processCandidatesWithAi(candidates, options.generate);
  const items = mergeAndPruneItems(options.previous?.items ?? [], incoming, {
    now: options.now,
    retentionDays: 30,
    maxItems: 1000
  });
  const timestamp = options.now.toISOString();

  return newsDatasetSchema.parse({
    schemaVersion: 1,
    generatedAt: timestamp,
    lastSuccessfulFetchAt: timestamp,
    sources: options.sourceResults.map((result) => result.health),
    items
  });
}
