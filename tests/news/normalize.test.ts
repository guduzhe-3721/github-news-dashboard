import { describe, expect, test } from "vitest";

import {
  canonicalizeUrl,
  deduplicateCandidates,
  stripHtml,
  titleFingerprint
} from "../../src/news/normalize.ts";

describe("stripHtml", () => {
  test("removes markup, scripts and decodes entities", () => {
    expect(
      stripHtml(
        "<p>Hello <strong>world</strong> &amp; more</p><script>alert('x')</script>"
      )
    ).toBe("Hello world & more");
  });
});

describe("canonicalizeUrl", () => {
  test("removes tracking parameters and fragments while preserving content parameters", () => {
    expect(
      canonicalizeUrl(
        "HTTPS://Example.com/story/?utm_source=rss&id=42&at_medium=RSS#section"
      )
    ).toBe("https://example.com/story?id=42");
  });

  test("rejects links outside HTTP and HTTPS", () => {
    expect(() => canonicalizeUrl("javascript:alert(1)")).toThrow(
      "Only HTTP and HTTPS URLs are supported"
    );
  });
});

describe("titleFingerprint", () => {
  test("normalizes width, case, punctuation and whitespace", () => {
    expect(titleFingerprint("ＡＩ News：A  New Era! ")).toBe(
      titleFingerprint("ai news a new era")
    );
  });
});

describe("deduplicateCandidates", () => {
  test("keeps the higher-priority source for duplicate URLs or titles", () => {
    const result = deduplicateCandidates([
      {
        sourceId: "lower",
        sourcePriority: 2,
        originalTitle: "Markets rally on policy news",
        url: "https://example.com/story?utm_source=rss",
        publishedAt: "2026-08-09T08:00:00.000Z"
      },
      {
        sourceId: "higher",
        sourcePriority: 0,
        originalTitle: "Markets rally on policy news",
        url: "https://example.com/story",
        publishedAt: "2026-08-09T08:05:00.000Z"
      },
      {
        sourceId: "unique",
        sourcePriority: 1,
        originalTitle: "A separate development",
        url: "https://example.com/other",
        publishedAt: "2026-08-09T08:10:00.000Z"
      }
    ]);

    expect(result.map((item) => item.sourceId)).toEqual(["higher", "unique"]);
  });
});
