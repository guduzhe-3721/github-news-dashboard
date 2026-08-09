export interface PageSettings {
  basePath: string;
  baseUrl: string;
}

function withoutTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export function derivePageSettings(
  repository: string,
  explicitBaseUrl?: string
): PageSettings {
  if (explicitBaseUrl) {
    const url = new URL(explicitBaseUrl);
    const pathname = url.pathname === "/" ? "/" : `${withoutTrailingSlash(url.pathname)}/`;
    return {
      basePath: pathname,
      baseUrl: withoutTrailingSlash(url.toString())
    };
  }

  const [owner, repositoryName] = repository.split("/");
  if (!owner || !repositoryName) {
    throw new Error("GITHUB_REPOSITORY must use the owner/repository format");
  }

  const accountSite = repositoryName.toLowerCase() === `${owner.toLowerCase()}.github.io`;
  return {
    basePath: accountSite ? "/" : `/${repositoryName}/`,
    baseUrl: accountSite
      ? `https://${owner}.github.io`
      : `https://${owner}.github.io/${repositoryName}`
  };
}

