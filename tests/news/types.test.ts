import { describe, expect, test } from "vitest";

import { newsItemSchema } from "../../src/news/types.ts";

describe("newsItemSchema", () => {
  test("rejects a non-web original link", () => {
    const result = newsItemSchema.safeParse({
      id: "unsafe",
      category: "world",
      importance: 3,
      titleZh: "不安全链接",
      summaryZh: "",
      originalTitle: "Unsafe link",
      url: "javascript:alert(1)",
      sourceId: "source",
      sourceName: "Source",
      publishedAt: "2026-08-09T09:00:00.000Z",
      fetchedAt: "2026-08-09T10:00:00.000Z",
      language: "en",
      aiStatus: "fallback"
    });

    expect(result.success).toBe(false);
  });

  test("returns a validation failure instead of throwing for a malformed URL", () => {
    expect(() =>
      newsItemSchema.safeParse({
        id: "malformed",
        category: "world",
        importance: 3,
        titleZh: "畸形链接",
        summaryZh: "",
        originalTitle: "Malformed link",
        url: "%",
        sourceId: "source",
        sourceName: "Source",
        publishedAt: "2026-08-09T09:00:00.000Z",
        fetchedAt: "2026-08-09T10:00:00.000Z",
        language: "en",
        aiStatus: "fallback"
      })
    ).not.toThrow();
  });

  test("rejects historical summaries beyond the feed excerpt boundary", () => {
    const result = newsItemSchema.safeParse({
      id: "too-long",
      category: "world",
      importance: 3,
      titleZh: "超长摘要",
      summaryZh: "长".repeat(241),
      originalTitle: "Long summary",
      url: "https://example.com/long",
      sourceId: "source",
      sourceName: "Source",
      publishedAt: "2026-08-09T09:00:00.000Z",
      fetchedAt: "2026-08-09T10:00:00.000Z",
      language: "en",
      aiStatus: "fallback"
    });

    expect(result.success).toBe(false);
  });
});
