# 晨间新闻

一个部署在 GitHub Pages 上的简体中文新闻看板。GitHub Actions 每小时自动读取 13 个 RSS/Atom 来源，使用 Gemini 生成中文标题、摘要、分类与重要度，然后发布静态页面。

## 部署

1. 将项目放入 GitHub 公开仓库，并在仓库的 **Settings → Pages** 中把 Source 设为 **GitHub Actions**。
2. 在 **Settings → Secrets and variables → Actions → Secrets** 新建 `GEMINI_API_KEY`。密钥只在新闻更新任务中使用，不会进入网页产物。
3. 如使用自定义域名，在 Actions Variables 中新增 `SITE_BASE_URL`，值为完整站点地址，例如 `https://news.example.com/`。默认无需设置。
4. 打开 **Actions → Update news and deploy Pages → Run workflow**，首次手动运行并等待部署完成。
5. 再手动运行一次，确认历史合并后没有重复新闻；之后工作流会在每小时第 17 分钟自动运行。

Gemini 不可用、限流或返回格式错误时，任务会保留来源标题和摘要继续发布。所有来源都失败时，任务会失败且不会覆盖当前线上站点。

## 本地开发

需要 Node.js 24 或兼容版本。

```bash
npm ci
npm run update:news
npm run dev
```

常用验证命令：

```bash
npm run typecheck
npm test
npm run build
```

本地不设置 `GEMINI_API_KEY` 时会自动使用回退内容，不产生模型调用。

## 数据与更新规则

- 页面数据接口固定为 `data/news.json`，结构版本为 `schemaVersion: 1`。
- 每轮只接收最近 48 小时内容，每个来源最多 5 条，全站新内容最多 30 条。
- 通过规范链接和原标题指纹去重，历史保留 30 天、最多 1,000 条。
- RSS 源超过 7 天没有新内容会标记为失活；单个来源失败不会阻断其他来源。
- “要闻”优先展示重要度 4–5 的条目，不足 20 条时按发布时间补入。

## 内容边界

本站只保存订阅源提供的标题、摘要、发布时间、来源名称和原文链接，不抓取正文与图片。新闻卡片均标注来源并链接原文。外部内容始终以纯文本渲染，不作为 HTML 注入页面。

GitHub Pages 在中国大陆可能访问不稳定，GitHub 定时任务也可能延迟或偶尔遗漏；遇到这种情况可在 Actions 页面手动运行更新任务。
