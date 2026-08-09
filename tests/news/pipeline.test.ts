import { describe, expect, test } from "vitest";

import {
  buildNewsDataset,
  selectCandidatesForRun
} from "../../src/news/pipeline.ts";
import type { SourceFetchResult } from "../../src/news/feeds.ts";

function result(
  sourceId: string,
  status: "ok" | "error",
  withCandidate = false
): SourceFetchResult {
  return {
    source: {
      id: sourceId,
      name: sourceId,
      feedUrl: `https://example.com/${sourceId}.xml`,
      defaultCategory: "world",
      priority: 0,
      language: "en"
    },
    health: {
      id: sourceId,
      name: sourceId,
      feedUrl: `https://example.com/${sourceId}.xml`,
      defaultCategory: "world",
      lastCheckedAt: "2026-08-09T10:00:00.000Z",
      status,
      itemCount: withCandidate ? 1 : 0,
      ...(status === "error" ? { message: "network failed" } : {})
    },
    candidates: withCandidate
      ? [
          {
            id: `${sourceId}-item`,
            sourceId,
            sourceName: sourceId,
            sourcePriority: 0,
            defaultCategory: "world",
            originalTitle: "Original headline",
            summary: "Original summary",
            url: `https://example.com/${sourceId}/story`,
            publishedAt: "2026-08-09T09:00:00.000Z",
            fetchedAt: "2026-08-09T10:00:00.000Z",
            language: "en"
          }
        ]
      : []
  };
}

describe("buildNewsDataset", () => {
  test("publishes successful sources and falls back when AI processing fails", async () => {
    const dataset = await buildNewsDataset({
      sourceResults: [result("ok-source", "ok", true), result("bad", "error")],
      previous: null,
      now: new Date("2026-08-09T10:00:00.000Z"),
      generate: async () => {
        throw new Error("rate limited");
      }
    });

    expect(dataset.sources.map(({ status }) => status)).toEqual(["ok", "error"]);
    expect(dataset.items[0]).toMatchObject({
      sourceId: "ok-source",
      aiStatus: "fallback"
    });
    expect(dataset.lastSuccessfulFetchAt).toBe("2026-08-09T10:00:00.000Z");
  });

  test("rejects a run when every source fails", async () => {
    await expect(
      buildNewsDataset({
        sourceResults: [result("bad-a", "error"), result("bad-b", "error")],
        previous: null,
        now: new Date("2026-08-09T10:00:00.000Z"),
        generate: async () => []
      })
    ).rejects.toThrow("No source completed successfully");
  });

  test("does not spend model quota reprocessing an item already in history", async () => {
    const sourceResult = result("known-source", "ok", true);
    const candidate = sourceResult.candidates[0]!;
    let modelCalls = 0;
    const previous = {
      schemaVersion: 1 as const,
      generatedAt: "2026-08-09T09:00:00.000Z",
      lastSuccessfulFetchAt: "2026-08-09T09:00:00.000Z",
      sources: [],
      items: [
        {
          id: candidate.id,
          category: "world" as const,
          importance: 5 as const,
          titleZh: "已经生成的中文标题",
          summaryZh: "这是一条已经成功生成并保存的中文新闻摘要，后续小时更新不应再次消耗模型额度，也不应在临时限流时被回退内容覆盖。",
          originalTitle: candidate.originalTitle,
          url: candidate.url,
          sourceId: candidate.sourceId,
          sourceName: candidate.sourceName,
          publishedAt: candidate.publishedAt,
          fetchedAt: candidate.fetchedAt,
          language: candidate.language,
          aiStatus: "generated" as const
        }
      ]
    };

    const dataset = await buildNewsDataset({
      sourceResults: [sourceResult],
      previous,
      now: new Date("2026-08-09T10:00:00.000Z"),
      generate: async () => {
        modelCalls += 1;
        throw new Error("rate limited");
      }
    });

    expect(modelCalls).toBe(0);
    expect(dataset.items[0]?.aiStatus).toBe("generated");
  });
});

describe("selectCandidatesForRun", () => {
  test("round-robins sources before applying the global limit", () => {
    const sourceResults = Array.from({ length: 7 }, (_, sourceIndex) => {
      const sourceResult = result(`source-${sourceIndex}`, "ok");
      sourceResult.source.priority = sourceIndex;
      sourceResult.candidates = Array.from({ length: 5 }, (_, itemIndex) => ({
        id: `${sourceIndex}-${itemIndex}`,
        sourceId: `source-${sourceIndex}`,
        sourceName: `source-${sourceIndex}`,
        sourcePriority: sourceIndex,
        defaultCategory: sourceIndex > 4 ? "technology" : "world",
        originalTitle: `Distinct headline ${sourceIndex}-${itemIndex}`,
        summary: "Summary",
        url: `https://example.com/${sourceIndex}/${itemIndex}`,
        publishedAt: `2026-08-09T0${9 - itemIndex}:00:00.000Z`,
        fetchedAt: "2026-08-09T10:00:00.000Z",
        language: "en"
      }));
      return sourceResult;
    });

    const selected = selectCandidatesForRun(sourceResults, 30);

    expect(selected).toHaveLength(30);
    expect(new Set(selected.map(({ sourceId }) => sourceId)).size).toBe(7);
    expect(selected.some(({ defaultCategory }) => defaultCategory === "technology")).toBe(true);
  });
});
