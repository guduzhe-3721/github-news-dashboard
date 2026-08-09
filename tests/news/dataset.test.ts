import { describe, expect, test } from "vitest";

import { mergeAndPruneItems, selectTopNews } from "../../src/news/dataset.ts";
import type { NewsItem } from "../../src/news/types.ts";

function item(
  id: string,
  publishedAt: string,
  importance: NewsItem["importance"] = 3
): NewsItem {
  return {
    id,
    category: "world",
    importance,
    titleZh: `标题 ${id}`,
    summaryZh: `摘要 ${id}`,
    originalTitle: `Original ${id}`,
    url: `https://example.com/${id}`,
    sourceId: "source",
    sourceName: "Source",
    publishedAt,
    fetchedAt: "2026-08-09T10:00:00.000Z",
    language: "en",
    aiStatus: "generated"
  };
}

describe("mergeAndPruneItems", () => {
  test("deduplicates by id, removes expired items and sorts newest first", () => {
    const result = mergeAndPruneItems(
      [
        item("kept-old", "2026-08-01T00:00:00.000Z"),
        item("duplicate", "2026-08-08T00:00:00.000Z"),
        item("expired", "2026-07-01T00:00:00.000Z")
      ],
      [
        item("newest", "2026-08-09T09:00:00.000Z"),
        item("duplicate", "2026-08-09T08:00:00.000Z")
      ],
      {
        now: new Date("2026-08-09T10:00:00.000Z"),
        retentionDays: 30,
        maxItems: 1000
      }
    );

    expect(result.map(({ id }) => id)).toEqual([
      "newest",
      "duplicate",
      "kept-old"
    ]);
  });

  test("caps the result after sorting", () => {
    const result = mergeAndPruneItems(
      [],
      [
        item("oldest", "2026-08-09T07:00:00.000Z"),
        item("newest", "2026-08-09T09:00:00.000Z"),
        item("middle", "2026-08-09T08:00:00.000Z")
      ],
      {
        now: new Date("2026-08-09T10:00:00.000Z"),
        retentionDays: 30,
        maxItems: 2
      }
    );

    expect(result.map(({ id }) => id)).toEqual(["newest", "middle"]);
  });

  test("deduplicates restored history against incoming canonical links and titles", () => {
    const historicalByLink = item("historical-link", "2026-08-08T08:00:00.000Z");
    historicalByLink.url = "https://example.com/story?utm_source=archive";
    const historicalByTitle = item("historical-title", "2026-08-08T07:00:00.000Z");
    historicalByTitle.originalTitle = "Same developing story";

    const incomingByLink = item("incoming-link", "2026-08-09T09:00:00.000Z");
    incomingByLink.url = "https://example.com/story";
    const incomingByTitle = item("incoming-title", "2026-08-09T08:00:00.000Z");
    incomingByTitle.originalTitle = "Same developing story";

    const result = mergeAndPruneItems(
      [historicalByLink, historicalByTitle],
      [incomingByLink, incomingByTitle],
      {
        now: new Date("2026-08-09T10:00:00.000Z"),
        retentionDays: 30,
        maxItems: 1000
      }
    );

    expect(result.map(({ id }) => id)).toEqual(["incoming-link", "incoming-title"]);
  });

  test("does not downgrade an existing generated item with incoming fallback content", () => {
    const generated = item("same", "2026-08-09T08:00:00.000Z");
    generated.aiStatus = "generated";
    generated.titleZh = "已有中文标题";
    const fallback = item("same", "2026-08-09T08:00:00.000Z");
    fallback.aiStatus = "fallback";
    fallback.titleZh = fallback.originalTitle;

    const result = mergeAndPruneItems([generated], [fallback], {
      now: new Date("2026-08-09T10:00:00.000Z"),
      retentionDays: 30,
      maxItems: 1000
    });

    expect(result[0]?.aiStatus).toBe("generated");
    expect(result[0]?.titleZh).toBe("已有中文标题");
  });
});

describe("selectTopNews", () => {
  test("prioritizes importance four and five then fills with newest items", () => {
    const items = [
      item("latest-low", "2026-08-09T09:00:00.000Z", 2),
      item("important-old", "2026-08-09T06:00:00.000Z", 5),
      item("latest-important", "2026-08-09T08:00:00.000Z", 4),
      item("middle-low", "2026-08-09T07:00:00.000Z", 3)
    ];

    expect(selectTopNews(items, 3).map(({ id }) => id)).toEqual([
      "latest-important",
      "important-old",
      "latest-low"
    ]);
  });
});
