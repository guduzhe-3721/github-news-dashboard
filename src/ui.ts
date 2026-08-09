import { selectTopNews } from "./news/dataset.ts";
import type { Category, NewsDataset, NewsItem } from "./news/types.ts";

type View = "top" | Category;

const TABS: ReadonlyArray<{ id: View; label: string }> = [
  { id: "top", label: "要闻" },
  { id: "world", label: "国际" },
  { id: "business", label: "财经" },
  { id: "technology", label: "科技" }
];

interface AppOptions {
  now?: Date;
  pageSize?: number;
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(value));
}

function createArticle(item: NewsItem): HTMLElement {
  const article = element("article", "news-card");
  const title = element("h2", "news-title");
  const link = element("a", "news-link", item.titleZh);
  link.href = item.url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  title.append(link);

  const summary = element("p", "news-summary", item.summaryZh || "该来源没有提供摘要。");
  const meta = element("div", "news-meta");
  const originalLink = element("a", "original-link", "阅读原文");
  originalLink.href = item.url;
  originalLink.target = "_blank";
  originalLink.rel = "noopener noreferrer";
  meta.append(
    element("span", "source-name", item.sourceName),
    element("span", "meta-separator", "·"),
    element("time", "published-time", formatDate(item.publishedAt)),
    element("span", "meta-separator", "·"),
    element(
      "span",
      "summary-label",
      item.aiStatus === "generated" ? "AI 摘要，仅供快速浏览" : "来源摘要"
    ),
    originalLink
  );

  article.append(title, summary, meta);
  return article;
}

export function createNewsApp(
  root: HTMLElement,
  dataset: NewsDataset,
  options: AppOptions = {}
): void {
  const now = options.now ?? new Date();
  const pageSize = options.pageSize ?? 30;
  let currentView: View = "top";
  let visibleCount = pageSize;

  const shell = element("div", "app-shell");
  const header = element("header", "site-header");
  const eyebrow = element("p", "eyebrow", "YOUR DAILY BRIEFING");
  const title = element("h1", "site-title", "晨间新闻");
  const updated = element(
    "p",
    "last-updated",
    `最近更新：${formatDate(dataset.lastSuccessfulFetchAt)}（北京时间）`
  );
  header.append(eyebrow, title, updated);

  if (
    now.getTime() - Date.parse(dataset.lastSuccessfulFetchAt) >
    3 * 60 * 60 * 1000
  ) {
    const warning = element(
      "p",
      "update-warning",
      "更新可能延迟：最近一次成功更新已超过 3 小时。"
    );
    warning.setAttribute("role", "status");
    header.append(warning);
  }

  const tabList = element("nav", "tabs");
  tabList.setAttribute("role", "tablist");
  tabList.setAttribute("aria-label", "新闻栏目");
  const tabButtons = new Map<View, HTMLButtonElement>();
  const feed = element("section", "news-feed");
  feed.id = "news-panel";
  feed.setAttribute("role", "tabpanel");
  feed.setAttribute("aria-live", "polite");

  function itemsForView(): NewsItem[] {
    if (currentView === "top") {
      return selectTopNews(dataset.items, 20);
    }
    return dataset.items.filter((item) => item.category === currentView);
  }

  function selectView(view: View, focus = false): void {
    currentView = view;
    visibleCount = pageSize;
    for (const [id, button] of tabButtons) {
      const selected = id === currentView;
      button.setAttribute("aria-selected", String(selected));
      button.tabIndex = selected ? 0 : -1;
    }
    renderFeed();
    if (focus) tabButtons.get(view)?.focus();
  }

  function renderFeed(): void {
    feed.replaceChildren();
    const activeTab = tabButtons.get(currentView);
    if (activeTab) feed.setAttribute("aria-labelledby", activeTab.id);
    const allItems = itemsForView();
    const visibleItems = allItems.slice(0, visibleCount);

    if (visibleItems.length === 0) {
      const empty = element("div", "empty-state");
      empty.append(
        element("h2", "empty-title", "这个栏目暂时没有新闻"),
        element("p", "empty-copy", "可能是来源暂时没有更新，请稍后再看。")
      );
      if (currentView !== "top") {
        const back = element("button", "secondary-button", "查看全部要闻");
        back.type = "button";
        back.dataset.backToTop = "";
        back.addEventListener("click", () => selectView("top", true));
        empty.append(back);
      }
      feed.append(empty);
      return;
    }

    const list = element("div", "news-list");
    list.append(...visibleItems.map(createArticle));
    feed.append(list);

    if (visibleItems.length < allItems.length) {
      const loadMore = element("button", "load-more", "加载更多");
      loadMore.type = "button";
      loadMore.dataset.loadMore = "";
      loadMore.addEventListener("click", () => {
        visibleCount += pageSize;
        renderFeed();
      });
      feed.append(loadMore);
    }
  }

  TABS.forEach((tab, index) => {
    const button = element("button", "tab-button", tab.label);
    button.type = "button";
    button.id = `news-tab-${tab.id}`;
    button.setAttribute("role", "tab");
    button.setAttribute("aria-controls", feed.id);
    button.setAttribute("aria-selected", String(tab.id === currentView));
    button.tabIndex = tab.id === currentView ? 0 : -1;
    button.addEventListener("click", () => selectView(tab.id));
    button.addEventListener("keydown", (event) => {
      let nextIndex = index;
      if (event.key === "ArrowRight") nextIndex = (index + 1) % TABS.length;
      else if (event.key === "ArrowLeft") nextIndex = (index - 1 + TABS.length) % TABS.length;
      else if (event.key === "Home") nextIndex = 0;
      else if (event.key === "End") nextIndex = TABS.length - 1;
      else return;
      event.preventDefault();
      selectView(TABS[nextIndex]!.id, true);
    });
    tabButtons.set(tab.id, button);
    tabList.append(button);
  });

  const footer = element(
    "footer",
    "site-footer",
    "标题与摘要来自公开 RSS，并链接至原始报道。"
  );
  shell.append(header, tabList, feed, footer);
  root.replaceChildren(shell);
  renderFeed();
}
