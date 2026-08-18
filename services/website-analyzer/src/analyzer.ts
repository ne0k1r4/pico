import * as cheerio from "cheerio";
import { fetchText, type FetchOptions } from "./fetcher";
import { detectFrameworks, detectPushNotifications, detectServiceWorker } from "./detectors";
import type { ExtractedAsset, PwaProfile, WebAppManifest, WebsiteProfile } from "./types";

export interface AnalyzerDependencies {
  fetchText?: typeof fetchText;
}

export class WebsiteAnalyzer {
  private readonly fetchText: typeof fetchText;

  constructor(
    private readonly fetchOptions: FetchOptions,
    dependencies: AnalyzerDependencies = {}
  ) {
    this.fetchText = dependencies.fetchText ?? fetchText;
  }

  async analyze(inputUrl: string): Promise<WebsiteProfile> {
    const page = await this.fetchText(inputUrl, this.fetchOptions);
    if (page.status < 200 || page.status >= 400) {
      throw new Error(`Website returned HTTP ${page.status}`);
    }

    const finalUrl = new URL(page.url);
    const $ = cheerio.load(page.body);
    const manifestUrl = resolveOptionalUrl(
      $("link[rel='manifest']").attr("href") ?? $("link[rel~='manifest']").attr("href"),
      finalUrl
    );
    const manifest = manifestUrl ? await this.fetchManifest(manifestUrl) : null;
    const assets = extractAssets($, finalUrl, manifest);
    const serviceWorker = detectServiceWorker(page.body);
    const title = cleanText(
      $("title").first().text() ||
        $("meta[property='og:title']").attr("content") ||
        manifest?.name ||
        manifest?.short_name ||
        ""
    );
    const description = cleanText(
      $("meta[name='description']").attr("content") ||
        $("meta[property='og:description']").attr("content") ||
        manifest?.description ||
        ""
    );
    const themeColor =
      normalizeHexColor($("meta[name='theme-color']").attr("content")) ??
      normalizeHexColor(manifest?.theme_color) ??
      null;

    return {
      url: inputUrl,
      finalUrl: finalUrl.toString(),
      origin: finalUrl.origin,
      title,
      name: cleanText(manifest?.name ?? manifest?.short_name ?? title ?? ""),
      description,
      themeColor,
      favicon: assets.find((asset) => asset.kind === "favicon" || asset.kind === "icon")?.url ?? null,
      assets,
      frameworks: detectFrameworks(page.body, $),
      pwa: {
        manifestUrl,
        manifest,
        serviceWorkerDetected: serviceWorker.detected,
        serviceWorkerEvidence: serviceWorker.evidence,
        pushNotificationsDetected: detectPushNotifications(page.body)
      },
      security: {
        https: finalUrl.protocol === "https:",
        contentSecurityPolicy: page.headers.has("content-security-policy"),
        xFrameOptions: page.headers.has("x-frame-options")
      },
      analyzedAt: new Date().toISOString()
    };
  }

  private async fetchManifest(manifestUrl: string): Promise<WebAppManifest | null> {
    try {
      const response = await this.fetchText(manifestUrl, this.fetchOptions);
      if (response.status < 200 || response.status >= 400) return null;
      const parsed = JSON.parse(response.body) as WebAppManifest;
      return normalizeManifest(parsed, new URL(manifestUrl));
    } catch {
      return null;
    }
  }
}

function extractAssets(
  $: cheerio.CheerioAPI,
  baseUrl: URL,
  manifest: WebAppManifest | null
): ExtractedAsset[] {
  const assets: ExtractedAsset[] = [];
  const seen = new Set<string>();
  const push = (asset: ExtractedAsset) => {
    const key = `${asset.kind}:${asset.url}`;
    if (!seen.has(key)) {
      seen.add(key);
      assets.push(asset);
    }
  };

  $("link[rel]").each((_, element) => {
    const rel = ($(element).attr("rel") ?? "").toLowerCase();
    const href = $(element).attr("href");
    if (!href) return;
    const url = resolveOptionalUrl(href, baseUrl);
    if (!url) return;
    const sizes = $(element).attr("sizes");
    const type = $(element).attr("type");
    if (rel.includes("apple-touch-icon")) {
      push({ kind: "apple-touch-icon", url, sizes, type, source: "html" });
    } else if (rel.includes("icon") || rel.includes("shortcut icon")) {
      push({ kind: "favicon", url, sizes, type, source: "html" });
    }
  });

  const ogImage = $("meta[property='og:image']").attr("content");
  const ogImageUrl = resolveOptionalUrl(ogImage, baseUrl);
  if (ogImageUrl) push({ kind: "logo", url: ogImageUrl, source: "opengraph" });

  for (const icon of manifest?.icons ?? []) {
    const url = resolveOptionalUrl(icon.src, baseUrl);
    if (url) {
      push({ kind: "icon", url, sizes: icon.sizes, type: icon.type, source: "manifest" });
    }
  }
  for (const screenshot of manifest?.screenshots ?? []) {
    const url = resolveOptionalUrl(screenshot.src, baseUrl);
    if (url) {
      push({
        kind: "screenshot",
        url,
        sizes: screenshot.sizes,
        type: screenshot.type,
        source: "manifest"
      });
    }
  }

  push({ kind: "favicon", url: new URL("/favicon.ico", baseUrl).toString(), source: "heuristic" });
  return assets;
}

function normalizeManifest(manifest: WebAppManifest, manifestUrl: URL): WebAppManifest {
  return {
    ...manifest,
    icons: manifest.icons?.map((icon) => ({
      ...icon,
      src: new URL(icon.src, manifestUrl).toString()
    })),
    screenshots: manifest.screenshots?.map((screenshot) => ({
      ...screenshot,
      src: new URL(screenshot.src, manifestUrl).toString()
    }))
  };
}

function resolveOptionalUrl(value: string | undefined, baseUrl: URL): string | null {
  if (!value) return null;
  try {
    const url = new URL(value, baseUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function cleanText(value: string): string | null {
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned.length > 0 ? cleaned : null;
}

function normalizeHexColor(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed.toUpperCase();
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    const [, r, g, b] = trimmed;
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return null;
}
