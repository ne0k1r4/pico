import { describe, expect, test } from "bun:test";
import { WebsiteAnalyzer } from "../src/analyzer";
import type { FetchResult } from "../src/fetcher";

const headers = new Headers({
  "content-security-policy": "default-src 'self'",
  "x-frame-options": "DENY"
});

describe("WebsiteAnalyzer", () => {
  test("extracts metadata, assets, frameworks, manifest, and service worker evidence", async () => {
    const analyzer = new WebsiteAnalyzer(
      { timeoutMs: 1000, maxBytes: 100_000, userAgent: "test" },
      {
        fetchText: async (url: string): Promise<FetchResult> => {
          if (url.endsWith("/manifest.webmanifest")) {
            return {
              url,
              status: 200,
              headers: new Headers({ "content-type": "application/manifest+json" }),
              body: JSON.stringify({
                name: "Example App",
                short_name: "Example",
                theme_color: "#155eef",
                icons: [{ src: "/icon-512.png", sizes: "512x512", type: "image/png" }],
                screenshots: [{ src: "/screen.png", sizes: "1280x720", type: "image/png" }]
              })
            };
          }
          return {
            url: "https://example.com/",
            status: 200,
            headers,
            body: `
              <!doctype html>
              <html>
                <head>
                  <title>Example</title>
                  <meta name="description" content="A useful app">
                  <meta name="theme-color" content="#123">
                  <meta property="og:image" content="/logo.png">
                  <link rel="manifest" href="/manifest.webmanifest">
                  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
                  <script id="__NEXT_DATA__" type="application/json">{}</script>
                </head>
                <body>
                  <div id="root"></div>
                  <script>navigator.serviceWorker.register('/sw.js'); Notification.requestPermission();</script>
                </body>
              </html>
            `
          };
        }
      }
    );

    const profile = await analyzer.analyze("https://example.com");
    expect(profile.title).toBe("Example");
    expect(profile.name).toBe("Example App");
    expect(profile.themeColor).toBe("#112233");
    expect(profile.favicon).toBe("https://example.com/favicon.svg");
    expect(profile.frameworks.map((item) => item.name)).toContain("nextjs");
    expect(profile.frameworks.map((item) => item.name)).toContain("react");
    expect(profile.pwa.manifestUrl).toBe("https://example.com/manifest.webmanifest");
    expect(profile.pwa.serviceWorkerDetected).toBe(true);
    expect(profile.pwa.pushNotificationsDetected).toBe(true);
    expect(profile.assets.some((asset) => asset.kind === "screenshot")).toBe(true);
    expect(profile.security.contentSecurityPolicy).toBe(true);
  });
});
