import { z } from "zod";

export const categorySchema = z.enum(["world", "business", "technology"]);
export type Category = z.infer<typeof categorySchema>;

export const aiStatusSchema = z.enum(["generated", "fallback"]);
export type AIStatus = z.infer<typeof aiStatusSchema>;

export const sourceStatusSchema = z.enum(["ok", "stale", "error"]);
export type SourceStatus = z.infer<typeof sourceStatusSchema>;

const webUrlSchema = z
  .string()
  .url()
  .refine((value) => {
    try {
      const protocol = new URL(value).protocol;
      return protocol === "http:" || protocol === "https:";
    } catch {
      return false;
    }
  }, "Only HTTP and HTTPS URLs are supported");

export interface SourceHealth {
  id: string;
  name: string;
  feedUrl: string;
  defaultCategory: Category;
  lastCheckedAt: string;
  status: SourceStatus;
  itemCount: number;
  message?: string;
}

export const newsItemSchema = z.object({
  id: z.string().min(1),
  category: categorySchema,
  importance: z.number().int().min(1).max(5),
  titleZh: z.string().min(1),
  summaryZh: z.string().max(240),
  originalTitle: z.string().min(1),
  url: webUrlSchema,
  sourceId: z.string().min(1),
  sourceName: z.string().min(1),
  publishedAt: z.string().datetime(),
  fetchedAt: z.string().datetime(),
  language: z.string().min(2),
  aiStatus: aiStatusSchema
});

export type NewsItem = z.infer<typeof newsItemSchema>;

export const sourceHealthSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  feedUrl: webUrlSchema,
  defaultCategory: categorySchema,
  lastCheckedAt: z.string().datetime(),
  status: sourceStatusSchema,
  itemCount: z.number().int().nonnegative(),
  message: z.string().optional()
});

export const newsDatasetSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.string().datetime(),
  lastSuccessfulFetchAt: z.string().datetime(),
  sources: z.array(sourceHealthSchema),
  items: z.array(newsItemSchema)
});

export type NewsDataset = z.infer<typeof newsDatasetSchema>;

export interface RawNewsCandidate {
  sourceId: string;
  sourcePriority: number;
  originalTitle: string;
  url: string;
  publishedAt: string;
}
