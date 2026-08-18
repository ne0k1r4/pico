export type FrameworkName =
  | "react"
  | "vue"
  | "angular"
  | "svelte"
  | "nextjs"
  | "nuxt"
  | "remix";

export interface Detection {
  name: FrameworkName;
  confidence: number;
  evidence: string[];
}

export interface PwaProfile {
  manifestUrl: string | null;
  manifest: WebAppManifest | null;
  serviceWorkerDetected: boolean;
  serviceWorkerEvidence: string[];
  pushNotificationsDetected: boolean;
}

export interface WebAppManifest {
  name?: string;
  short_name?: string;
  description?: string;
  start_url?: string;
  scope?: string;
  display?: string;
  theme_color?: string;
  background_color?: string;
  icons?: ManifestIcon[];
  screenshots?: ManifestScreenshot[];
}

export interface ManifestIcon {
  src: string;
  sizes?: string;
  type?: string;
  purpose?: string;
}

export interface ManifestScreenshot {
  src: string;
  sizes?: string;
  type?: string;
  form_factor?: string;
}

export interface ExtractedAsset {
  kind: "favicon" | "icon" | "logo" | "apple-touch-icon" | "screenshot";
  url: string;
  sizes?: string;
  type?: string;
  source: "html" | "manifest" | "opengraph" | "heuristic";
}

export interface WebsiteProfile {
  url: string;
  finalUrl: string;
  origin: string;
  title: string | null;
  name: string | null;
  description: string | null;
  themeColor: string | null;
  favicon: string | null;
  assets: ExtractedAsset[];
  frameworks: Detection[];
  pwa: PwaProfile;
  security: {
    https: boolean;
    contentSecurityPolicy: boolean;
    xFrameOptions: boolean;
  };
  analyzedAt: string;
}

export interface AnalyzeRequest {
  url: string;
  forceRefresh?: boolean;
}

export interface AnalyzeResponse {
  profile: WebsiteProfile;
  cache: {
    hit: boolean;
    ttlSeconds: number;
  };
}
