import type { Category } from "./types.ts";

export interface NewsSource {
  id: string;
  name: string;
  feedUrl: string;
  defaultCategory: Category;
  priority: number;
  language: string;
}

export const NEWS_SOURCES: NewsSource[] = [
  {
    id: "bbc-zh",
    name: "BBC 中文",
    feedUrl: "https://feeds.bbci.co.uk/zhongwen/simp/rss.xml",
    defaultCategory: "world",
    priority: 0,
    language: "zh"
  },
  {
    id: "nyt-zh",
    name: "纽约时报中文网",
    feedUrl: "https://cn.nytimes.com/rss/",
    defaultCategory: "world",
    priority: 1,
    language: "zh"
  },
  {
    id: "rfi-zh",
    name: "法国国际广播电台中文",
    feedUrl: "https://www.rfi.fr/cn/rss",
    defaultCategory: "world",
    priority: 2,
    language: "zh"
  },
  {
    id: "bbc-world",
    name: "BBC World",
    feedUrl: "https://feeds.bbci.co.uk/news/world/rss.xml",
    defaultCategory: "world",
    priority: 3,
    language: "en"
  },
  {
    id: "guardian-world",
    name: "The Guardian World",
    feedUrl: "https://www.theguardian.com/world/rss",
    defaultCategory: "world",
    priority: 4,
    language: "en"
  },
  {
    id: "npr-world",
    name: "NPR World",
    feedUrl: "https://feeds.npr.org/1004/rss.xml",
    defaultCategory: "world",
    priority: 5,
    language: "en"
  },
  {
    id: "bbc-business",
    name: "BBC Business",
    feedUrl: "https://feeds.bbci.co.uk/news/business/rss.xml",
    defaultCategory: "business",
    priority: 6,
    language: "en"
  },
  {
    id: "guardian-business",
    name: "The Guardian Business",
    feedUrl: "https://www.theguardian.com/business/rss",
    defaultCategory: "business",
    priority: 7,
    language: "en"
  },
  {
    id: "cnbc-finance",
    name: "CNBC Finance",
    feedUrl: "https://www.cnbc.com/id/10000664/device/rss/rss.html",
    defaultCategory: "business",
    priority: 8,
    language: "en"
  },
  {
    id: "ithome",
    name: "IT之家",
    feedUrl: "https://www.ithome.com/rss/",
    defaultCategory: "technology",
    priority: 9,
    language: "zh"
  },
  {
    id: "techcrunch",
    name: "TechCrunch",
    feedUrl: "https://techcrunch.com/feed/",
    defaultCategory: "technology",
    priority: 10,
    language: "en"
  },
  {
    id: "ars-technica",
    name: "Ars Technica",
    feedUrl: "https://feeds.arstechnica.com/arstechnica/index",
    defaultCategory: "technology",
    priority: 11,
    language: "en"
  },
  {
    id: "guardian-technology",
    name: "The Guardian Technology",
    feedUrl: "https://www.theguardian.com/technology/rss",
    defaultCategory: "technology",
    priority: 12,
    language: "en"
  }
];

