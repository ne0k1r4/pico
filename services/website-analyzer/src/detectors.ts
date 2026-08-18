import * as cheerio from "cheerio";
import type { Detection, FrameworkName } from "./types";

type EvidenceMap = Map<FrameworkName, Set<string>>;

export function detectFrameworks(html: string, $: cheerio.CheerioAPI): Detection[] {
  const evidence: EvidenceMap = new Map();

  const add = (name: FrameworkName, item: string) => {
    const set = evidence.get(name) ?? new Set<string>();
    set.add(item);
    evidence.set(name, set);
  };

  if ($("[data-reactroot], [data-reactid], #root").length > 0) add("react", "react root markers");
  if (html.includes("__REACT_DEVTOOLS_GLOBAL_HOOK__")) add("react", "react devtools hook");
  if (html.includes("__NEXT_DATA__") || $("script#__NEXT_DATA__").length > 0) {
    add("nextjs", "__NEXT_DATA__ script");
    add("react", "Next.js implies React");
  }
  if (html.includes("/_next/static/")) {
    add("nextjs", "_next static assets");
    add("react", "Next.js asset path");
  }
  if ($("[data-v-app], [data-server-rendered]").length > 0) add("vue", "Vue DOM markers");
  if (html.includes("__NUXT__") || html.includes("/_nuxt/")) {
    add("nuxt", "Nuxt runtime markers");
    add("vue", "Nuxt implies Vue");
  }
  if ($("[ng-version], [ng-app], app-root").length > 0) add("angular", "Angular DOM markers");
  if (html.includes("ng-version")) add("angular", "Angular version marker");
  if ($("[data-svelte-h]").length > 0 || html.includes("svelte-")) add("svelte", "Svelte markers");
  if (html.includes("__remixContext") || html.includes("/build/_assets/")) {
    add("remix", "Remix runtime markers");
    add("react", "Remix implies React");
  }

  $("script[src], link[href]").each((_, element) => {
    const value = ($(element).attr("src") ?? $(element).attr("href") ?? "").toLowerCase();
    if (value.includes("react")) add("react", `asset ${value}`);
    if (value.includes("vue")) add("vue", `asset ${value}`);
    if (value.includes("angular")) add("angular", `asset ${value}`);
    if (value.includes("svelte")) add("svelte", `asset ${value}`);
    if (value.includes("_next")) add("nextjs", `asset ${value}`);
    if (value.includes("_nuxt")) add("nuxt", `asset ${value}`);
    if (value.includes("remix")) add("remix", `asset ${value}`);
  });

  return [...evidence.entries()]
    .map(([name, items]) => ({
      name,
      confidence: Math.min(0.99, 0.55 + items.size * 0.15),
      evidence: [...items].slice(0, 8)
    }))
    .sort((a, b) => b.confidence - a.confidence || a.name.localeCompare(b.name));
}

export function detectServiceWorker(html: string): { detected: boolean; evidence: string[] } {
  const evidence: string[] = [];
  if (html.includes("serviceWorker.register")) evidence.push("serviceWorker.register call");
  if (html.includes("navigator.serviceWorker")) evidence.push("navigator.serviceWorker usage");
  if (/workbox-[a-z0-9]+\.js/i.test(html)) evidence.push("Workbox asset reference");
  return { detected: evidence.length > 0, evidence };
}

export function detectPushNotifications(html: string): boolean {
  return (
    html.includes("PushManager") ||
    html.includes("Notification.requestPermission") ||
    html.includes("pushManager.subscribe")
  );
}
