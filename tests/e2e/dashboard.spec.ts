import { expect, test } from "@playwright/test";

function makeDataset() {
  const generatedAt = "2026-08-09T10:00:00.000Z";
  return {
    schemaVersion: 1,
    generatedAt,
    lastSuccessfulFetchAt: generatedAt,
    sources: [],
    items: Array.from({ length: 35 }, (_, index) => ({
      id: `world-${index}`,
      category: "world",
      importance: index < 5 ? 5 : 2,
      titleZh: `国际新闻标题 ${index + 1}`,
      summaryZh: `这是第 ${index + 1} 条国际新闻的中文摘要，用于验证分页、移动端排版和原文跳转行为。`,
      originalTitle: `World story ${index + 1}`,
      url: `https://example.com/story-${index + 1}`,
      sourceId: "fixture",
      sourceName: "测试来源",
      publishedAt: new Date(Date.parse(generatedAt) - index * 60_000).toISOString(),
      fetchedAt: generatedAt,
      language: "en",
      aiStatus: "generated"
    }))
  };
}

test.beforeEach(async ({ page }) => {
  await page.route("**/data/news.json", (route) =>
    route.fulfill({ json: makeDataset() })
  );
});

test("四个标签、键盘导航、分页和原文链接可用", async ({ page }) => {
  await page.goto("./");

  const tabs = page.getByRole("tab");
  await expect(tabs).toHaveCount(4);
  await tabs.filter({ hasText: "要闻" }).press("ArrowRight");
  await expect(tabs.filter({ hasText: "国际" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("article")).toHaveCount(30);

  await page.getByRole("button", { name: "加载更多" }).click();
  await expect(page.getByRole("article")).toHaveCount(35);

  const originalLink = page.getByRole("link", { name: "阅读原文" }).first();
  await expect(originalLink).toHaveAttribute("href", "https://example.com/story-1");
  await expect(originalLink).toHaveAttribute("target", "_blank");
});

test("移动端页面不产生水平溢出", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "仅在移动端项目验证");
  await page.goto("./");

  await expect(page.getByRole("heading", { name: "晨间新闻" })).toBeVisible();
  const widths = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth
  }));
  expect(widths.content).toBeLessThanOrEqual(widths.viewport);
});
