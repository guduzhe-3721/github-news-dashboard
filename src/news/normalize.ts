import { createHash } from "node:crypto";

import { decode } from "html-entities";
import sanitizeHtml from "sanitize-html";

import { canonicalizeUrl, titleFingerprint } from "./identity.ts";
import type { RawNewsCandidate } from "./types.ts";

export { canonicalizeUrl, titleFingerprint } from "./identity.ts";

export function stripHtml(value: string): string {
  return decode(
    sanitizeHtml(value, {
      allowedTags: [],
      allowedAttributes: {}
    })
  )
    .replace(/\s+/g, " ")
    .trim();
}

export function stableNewsId(url: string): string {
  return createHash("sha256")
    .update(canonicalizeUrl(url))
    .digest("hex")
    .slice(0, 24);
}

export function deduplicateCandidates<T extends RawNewsCandidate>(
  candidates: T[]
): T[] {
  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();
  const sorted = [...candidates].sort(
    (a, b) =>
      a.sourcePriority - b.sourcePriority ||
      Date.parse(b.publishedAt) - Date.parse(a.publishedAt)
  );

  return sorted.filter((candidate) => {
    const url = canonicalizeUrl(candidate.url);
    const title = titleFingerprint(candidate.originalTitle);
    if (seenUrls.has(url) || seenTitles.has(title)) {
      return false;
    }
    seenUrls.add(url);
    seenTitles.add(title);
    return true;
  });
}
