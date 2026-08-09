import { appendFile } from "node:fs/promises";

import { derivePageSettings } from "../src/news/runtime.ts";

async function main(): Promise<void> {
  const repository = process.env.GITHUB_REPOSITORY;
  if (!repository) {
    throw new Error("GITHUB_REPOSITORY is required");
  }

  const settings = derivePageSettings(repository, process.env.SITE_BASE_URL);
  const output = `VITE_BASE_PATH=${settings.basePath}\n`;
  const environmentFile = process.env.GITHUB_ENV;

  if (environmentFile) {
    await appendFile(environmentFile, output, "utf8");
  } else {
    process.stdout.write(output);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Page settings failed: ${message}`);
  process.exitCode = 1;
});
