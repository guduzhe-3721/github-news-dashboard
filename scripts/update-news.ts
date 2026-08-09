import { appendFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { createGeminiGenerator, type AIGenerator } from "../src/news/ai.ts";
import { fetchSource, loadPreviousDataset } from "../src/news/feeds.ts";
import { buildNewsDataset } from "../src/news/pipeline.ts";
import { derivePageSettings } from "../src/news/runtime.ts";
import { NEWS_SOURCES } from "../src/news/sources.ts";

function unavailableGenerator(reason: string): AIGenerator {
  return async () => {
    throw new Error(reason);
  };
}

async function writeJobSummary(
  sourceResults: Awaited<ReturnType<typeof fetchSource>>[],
  itemCount: number
): Promise<void> {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) return;

  const rows = sourceResults
    .map(
      ({ health }) =>
        `| ${health.name} | ${health.status} | ${health.itemCount} | ${health.message ?? ""} |`
    )
    .join("\n");
  const markdown = `## 新闻更新摘要\n\n已发布数据总量：**${itemCount}**\n\n| 来源 | 状态 | 新条目 | 说明 |\n|---|---:|---:|---|\n${rows}\n`;
  await appendFile(summaryPath, markdown, "utf8");
}

async function main(): Promise<void> {
  const now = new Date();
  const repository = process.env.GITHUB_REPOSITORY ?? "local/news-dashboard";
  const pageSettings = derivePageSettings(repository, process.env.SITE_BASE_URL);
  const previousUrl = `${pageSettings.baseUrl}/data/news.json`;

  const [previous, sourceResults] = await Promise.all([
    loadPreviousDataset(previousUrl),
    Promise.all(NEWS_SOURCES.map((source) => fetchSource(source, { now })))
  ]);

  const apiKey = process.env.GEMINI_API_KEY;
  const generate = apiKey
    ? createGeminiGenerator(apiKey)
    : unavailableGenerator("GEMINI_API_KEY is not configured");
  const dataset = await buildNewsDataset({
    sourceResults,
    previous,
    now,
    generate
  });

  const outputDirectory = path.resolve("public/data");
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(
    path.join(outputDirectory, "news.json"),
    `${JSON.stringify(dataset, null, 2)}\n`,
    "utf8"
  );
  await writeJobSummary(sourceResults, dataset.items.length);

  const ok = sourceResults.filter(({ health }) => health.status === "ok").length;
  const stale = sourceResults.filter(({ health }) => health.status === "stale").length;
  const failed = sourceResults.filter(({ health }) => health.status === "error").length;
  console.log(
    `News update complete: ${dataset.items.length} items, ${ok} sources ok, ${stale} stale, ${failed} failed.`
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`News update failed: ${message}`);
  process.exitCode = 1;
});
