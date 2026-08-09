import { describe, expect, test } from "vitest";

import { processCandidatesWithAi } from "../../src/news/ai.ts";
import type { FeedCandidate } from "../../src/news/feeds.ts";

function candidate(index: number): FeedCandidate {
  return {
    id: `item-${index}`,
    sourceId: "source",
    sourceName: "Source",
    sourcePriority: 0,
    defaultCategory: "world",
    originalTitle: `Original ${index}`,
    summary: `Summary ${index}`,
    url: `https://example.com/${index}`,
    publishedAt: "2026-08-09T09:00:00.000Z",
    fetchedAt: "2026-08-09T10:00:00.000Z",
    language: "en"
  };
}

describe("processCandidatesWithAi", () => {
  test("maps valid structured model output onto news items", async () => {
    const result = await processCandidatesWithAi([candidate(1)], async () => [
      {
        id: "item-1",
        titleZh: "全球市场关注新政策",
        summaryZh: "多项最新政策信号推动全球市场重新评估未来走势，股票、债券与大宗商品价格出现明显分化，投资者正等待后续经济数据。",
        category: "business",
        importance: 4
      }
    ]);

    expect(result[0]).toMatchObject({
      id: "item-1",
      titleZh: "全球市场关注新政策",
      category: "business",
      importance: 4,
      aiStatus: "generated"
    });
  });

  test("falls back per batch when the model response is invalid", async () => {
    const result = await processCandidatesWithAi(
      [candidate(1)],
      async () => ({ unexpected: true })
    );

    expect(result[0]).toMatchObject({
      titleZh: "Original 1",
      summaryZh: "Summary 1",
      category: "world",
      importance: 3,
      aiStatus: "fallback"
    });
  });

  test("processes at most ten items per request and at most three batches", async () => {
    let calls = 0;
    const result = await processCandidatesWithAi(
      Array.from({ length: 35 }, (_, index) => candidate(index)),
      async (batch) => {
        calls += 1;
        return batch.map((input) => ({
          id: input.id,
          titleZh: `中文 ${input.id}`,
          summaryZh: "这是一段用于验证批量处理行为的中文新闻摘要，内容长度足以满足系统规定，并确保每一批模型输出都能通过结构校验要求。",
          category: "world",
          importance: 3
        }));
      }
    );

    expect(calls).toBe(3);
    expect(result).toHaveLength(30);
  });

  test("falls back when a model batch exceeds its timeout", async () => {
    const result = await processCandidatesWithAi(
      [candidate(1)],
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 30));
        return [
          {
            id: "item-1",
            titleZh: "迟到的模型结果",
            summaryZh: "这是一段在超时之后才返回的模型摘要，因此处理流程不应继续等待，而应立即采用来源提供的标题摘要完成本轮发布。",
            category: "world",
            importance: 3
          }
        ];
      },
      { timeoutMs: 5 }
    );

    expect(result[0]?.aiStatus).toBe("fallback");
  });
});
