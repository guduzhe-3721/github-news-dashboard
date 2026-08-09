import { describe, expect, test } from "vitest";

import { derivePageSettings } from "../../src/news/runtime.ts";

describe("derivePageSettings", () => {
  test("uses a repository subpath for a project Pages site", () => {
    expect(derivePageSettings("octocat/news-dashboard")).toEqual({
      basePath: "/news-dashboard/",
      baseUrl: "https://octocat.github.io/news-dashboard"
    });
  });

  test("uses the root path for an account Pages repository", () => {
    expect(derivePageSettings("octocat/octocat.github.io")).toEqual({
      basePath: "/",
      baseUrl: "https://octocat.github.io"
    });
  });

  test("uses an explicit custom URL without changing it to github.io", () => {
    expect(
      derivePageSettings("octocat/news-dashboard", "https://news.example.com/")
    ).toEqual({
      basePath: "/",
      baseUrl: "https://news.example.com"
    });
  });
});
