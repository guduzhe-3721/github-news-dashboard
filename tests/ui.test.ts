// @vitest-environment jsdom

import { beforeEach, describe, expect, test } from "vitest";

import { createNewsApp } from "../src/ui.ts";
import type { NewsDataset, NewsItem } from "../src/news/types.ts";

function item(
  id: string,
  category: NewsItem["category"],
  importance: NewsItem["importance"],
  publishedAt: string,
  titleZh = `标题 ${id}`
): NewsItem {
  return {
    id,
    category,
    importance,
    titleZh,
    summaryZh: `这是 ${id} 的中文摘要，用于验证新闻卡片中的内容展示行为。`,
    originalTitle: `Original ${id}`,
    url: `https://example.com/${id}`,
    sourceId: "source",
    sourceName: "测试来源",
    publishedAt,
    fetchedAt: "2026-08-09T10:00:00.000Z",
    language: "zh",
    aiStatus: "generated"
  };
}

function dataset(items: NewsItem[]): NewsDataset {
  return {
    schemaVersion: 1,
    generatedAt: "2026-08-09T10:00:00.000Z",
    lastSuccessfulFetchAt: "2026-08-09T09:30:00.000Z",
    sources: [],
    items
  };
}

const items = [
  item("world-important", "world", 5, "2026-08-09T09:00:00.000Z"),
  item("business", "business", 3, "2026-08-09T08:00:00.000Z"),
  item("technology", "technology", 4, "2026-08-09T07:00:00.000Z"),
  item("world-low", "world", 2, "2026-08-09T06:00:00.000Z")
];

beforeEach(() => {
  document.body.innerHTML = '<main id="app"></main>';
});

describe("createNewsApp", () => {
  test("renders the top-news tab by default with accessible navigation", () => {
    const root = document.querySelector<HTMLElement>("#app")!;
    createNewsApp(root, dataset(items), {
      now: new Date("2026-08-09T10:00:00.000Z"),
      pageSize: 2
    });

    expect(root.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toBe(
      "要闻"
    );
    expect(root.querySelectorAll("article")).toHaveLength(2);
    expect(root.textContent).toContain("标题 world-important");
    expect(root.textContent).toContain("AI 摘要，仅供快速浏览");
    const selectedTab = root.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')!;
    const panel = root.querySelector<HTMLElement>('[role="tabpanel"]')!;
    expect(selectedTab.getAttribute("aria-controls")).toBe(panel.id);
    expect(panel.getAttribute("aria-labelledby")).toBe(selectedTab.id);
  });

  test("switches categories and supports arrow-key tab navigation", () => {
    const root = document.querySelector<HTMLElement>("#app")!;
    createNewsApp(root, dataset(items), {
      now: new Date("2026-08-09T10:00:00.000Z"),
      pageSize: 30
    });
    const tabs = [...root.querySelectorAll<HTMLButtonElement>('[role="tab"]')];

    tabs[0]!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));

    expect(root.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toBe(
      "国际"
    );
    expect(root.textContent).toContain("标题 world-important");
    expect(root.textContent).not.toContain("标题 business");
  });

  test("loads additional items without another network request", () => {
    const root = document.querySelector<HTMLElement>("#app")!;
    createNewsApp(root, dataset(items), {
      now: new Date("2026-08-09T10:00:00.000Z"),
      pageSize: 2
    });

    root.querySelector<HTMLButtonElement>("[data-load-more]")!.click();

    expect(root.querySelectorAll("article")).toHaveLength(4);
    expect(root.querySelector("[data-load-more]")).toBeNull();
  });

  test("shows a delayed-update warning after three hours", () => {
    const root = document.querySelector<HTMLElement>("#app")!;
    const stale = dataset(items);
    stale.lastSuccessfulFetchAt = "2026-08-09T05:00:00.000Z";

    createNewsApp(root, stale, {
      now: new Date("2026-08-09T10:00:00.000Z")
    });

    expect(root.querySelector('[role="status"]')?.textContent).toContain(
      "更新可能延迟"
    );
  });

  test("renders external text as text instead of executable markup", () => {
    const root = document.querySelector<HTMLElement>("#app")!;
    const malicious = item(
      "unsafe",
      "technology",
      5,
      "2026-08-09T09:00:00.000Z",
      '<img src=x onerror="window.hacked=true">安全标题'
    );

    createNewsApp(root, dataset([malicious]), {
      now: new Date("2026-08-09T10:00:00.000Z")
    });

    expect(root.querySelector("img")).toBeNull();
    expect(root.textContent).toContain('<img src=x onerror="window.hacked=true">安全标题');
  });

  test("offers a route back to top news for an empty category", () => {
    const root = document.querySelector<HTMLElement>("#app")!;
    createNewsApp(root, dataset([items[0]!]), {
      now: new Date("2026-08-09T10:00:00.000Z")
    });
    const technologyTab = [...root.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(
      (tab) => tab.textContent === "科技"
    )!;

    technologyTab.click();
    root.querySelector<HTMLButtonElement>("[data-back-to-top]")!.click();

    expect(root.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toBe(
      "要闻"
    );
  });
});
