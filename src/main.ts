import "./styles.css";

import { newsDatasetSchema } from "./news/types.ts";
import { createNewsApp } from "./ui.ts";

async function start(): Promise<void> {
  const root = document.querySelector<HTMLElement>("#app");
  if (!root) throw new Error("Missing #app root element");

  try {
    const response = await fetch(`${import.meta.env.BASE_URL}data/news.json`, {
      headers: { accept: "application/json" }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    createNewsApp(root, newsDatasetSchema.parse(await response.json()));
  } catch {
    const message = document.createElement("p");
    message.className = "fatal-error";
    message.setAttribute("role", "alert");
    message.textContent = "新闻数据暂时无法读取，请稍后刷新页面。";
    root.replaceChildren(message);
  }
}

void start();

