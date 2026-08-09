import { describe, expect, test } from "vitest";

import {
  fetchSource,
  loadPreviousDataset,
  parseFeedXml
} from "../../src/news/feeds.ts";
import type { NewsSource } from "../../src/news/sources.ts";

const source: NewsSource = {
  id: "test-world",
  name: "Test World",
  feedUrl: "https://feeds.example.com/world.xml",
  defaultCategory: "world",
  priority: 0,
  language: "en"
};

function rss(items: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
    <rss version="2.0"><channel><title>Fixture</title>${items}</channel></rss>`;
}

function rssItem(
  title: string,
  link: string,
  date: string,
  description = "<p>Source summary</p>"
): string {
  return `<item>
    <title>${title}</title>
    <link>${link}</link>
    <pubDate>${date}</pubDate>
    <description><![CDATA[${description}]]></description>
  </item>`;
}

describe("parseFeedXml", () => {
  test("keeps valid items from the last 48 hours and cleans summaries", async () => {
    const xml = rss(
      rssItem(
        "Fresh story",
        "https://example.com/fresh?utm_source=rss",
        "Sun, 09 Aug 2026 08:00:00 GMT",
        "<p>A <strong>clean</strong> summary.</p>"
      ) +
        rssItem(
          "Too old",
          "https://example.com/old",
          "Thu, 06 Aug 2026 08:00:00 GMT"
        )
    );

    const result = await parseFeedXml(
      source,
      xml,
      new Date("2026-08-09T10:00:00.000Z")
    );

    expect(result.health.status).toBe("ok");
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toMatchObject({
      originalTitle: "Fresh story",
      summary: "A clean summary.",
      url: "https://example.com/fresh"
    });
  });

  test("marks a feed stale when its newest dated item is older than seven days", async () => {
    const xml = rss(
      rssItem(
        "Old story",
        "https://example.com/old",
        "Sat, 01 Aug 2026 08:00:00 GMT"
      )
    );

    const result = await parseFeedXml(
      source,
      xml,
      new Date("2026-08-09T10:00:00.000Z")
    );

    expect(result.health.status).toBe("stale");
    expect(result.candidates).toEqual([]);
  });

  test("does not accept entries dated in the future", async () => {
    const xml = rss(
      rssItem(
        "Current story",
        "https://example.com/current",
        "Sun, 09 Aug 2026 09:00:00 GMT"
      ) +
        rssItem(
          "Future story",
          "https://example.com/future",
          "Mon, 10 Aug 2026 09:00:00 GMT"
        )
    );

    const result = await parseFeedXml(
      source,
      xml,
      new Date("2026-08-09T10:00:00.000Z")
    );

    expect(result.candidates.map(({ originalTitle }) => originalTitle)).toEqual([
      "Current story"
    ]);
  });

  test("parses Atom entries as well as RSS items", async () => {
    const atom = `<?xml version="1.0" encoding="UTF-8"?>
      <feed xmlns="http://www.w3.org/2005/Atom">
        <title>Fixture Atom</title>
        <entry>
          <title>Atom story</title>
          <link href="https://example.com/atom?utm_medium=feed" />
          <updated>2026-08-09T09:00:00Z</updated>
          <summary type="html">&lt;p&gt;Atom summary&lt;/p&gt;</summary>
        </entry>
      </feed>`;

    const result = await parseFeedXml(
      source,
      atom,
      new Date("2026-08-09T10:00:00.000Z")
    );

    expect(result.candidates[0]).toMatchObject({
      originalTitle: "Atom story",
      summary: "Atom summary",
      url: "https://example.com/atom"
    });
  });

  test("caps feed-provided text so a full article is not retained", async () => {
    const longText = "长".repeat(500);
    const xml = rss(
      rssItem(
        "Long content",
        "https://example.com/long",
        "Sun, 09 Aug 2026 09:00:00 GMT",
        `<p>${longText}</p>`
      )
    );

    const result = await parseFeedXml(
      source,
      xml,
      new Date("2026-08-09T10:00:00.000Z")
    );

    expect(Array.from(result.candidates[0]!.summary)).toHaveLength(240);
    expect(result.candidates[0]!.summary.endsWith("…")).toBe(true);
  });
});

describe("fetchSource", () => {
  test("retries two failures and returns the successful parsed feed", async () => {
    let attempts = 0;
    const fetcher = async () => {
      attempts += 1;
      if (attempts < 3) {
        return new Response("unavailable", { status: 503 });
      }
      return new Response(
        rss(
          rssItem(
            "Recovered",
            "https://example.com/recovered",
            "Sun, 09 Aug 2026 09:00:00 GMT"
          )
        ),
        { status: 200 }
      );
    };

    const result = await fetchSource(source, {
      fetcher,
      now: new Date("2026-08-09T10:00:00.000Z"),
      retryDelayMs: 0
    });

    expect(attempts).toBe(3);
    expect(result.health.status).toBe("ok");
    expect(result.candidates[0]?.originalTitle).toBe("Recovered");
  });

  test("times out and retries a source without blocking the run", async () => {
    let attempts = 0;
    const fetcher = async (_input: string, init?: RequestInit): Promise<Response> => {
      attempts += 1;
      return await new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("aborted", "AbortError"))
        );
      });
    };

    const result = await fetchSource(source, {
      fetcher,
      now: new Date("2026-08-09T10:00:00.000Z"),
      timeoutMs: 5,
      retryDelayMs: 0
    });

    expect(attempts).toBe(3);
    expect(result.health.status).toBe("error");
    expect(result.candidates).toEqual([]);
  });
});

describe("loadPreviousDataset", () => {
  test("returns null for malformed or schema-incompatible JSON", async () => {
    const fetcher = async () =>
      new Response(JSON.stringify({ schemaVersion: 99 }), { status: 200 });

    await expect(
      loadPreviousDataset("https://example.com/data/news.json", fetcher)
    ).resolves.toBeNull();
  });

  test("bounds the historical dataset request with an abort signal", async () => {
    let receivedSignal: AbortSignal | null = null;
    const fetcher = async (_input: string, init?: RequestInit) => {
      receivedSignal = init?.signal ?? null;
      return new Response("not found", { status: 404 });
    };

    await loadPreviousDataset("https://example.com/data/news.json", fetcher);

    expect(receivedSignal).toBeInstanceOf(AbortSignal);
  });
});
