import { fetch, Agent } from "undici";
import { assertPublicResolvable, parsePublicHttpUrl } from "./urlPolicy";

export interface FetchResult {
  url: string;
  status: number;
  headers: Headers;
  body: string;
}

export interface FetchOptions {
  timeoutMs: number;
  maxBytes: number;
  userAgent: string;
}

const dispatcher = new Agent({
  connect: { timeout: 5_000 },
  pipelining: 0
});

export async function fetchText(input: string, options: FetchOptions): Promise<FetchResult> {
  const firstUrl = parsePublicHttpUrl(input);
  await assertPublicResolvable(firstUrl);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
  try {
    const response = await fetch(firstUrl, {
      dispatcher,
      redirect: "manual",
      signal: controller.signal,
      headers: {
        "user-agent": options.userAgent,
        accept: "text/html,application/xhtml+xml,application/manifest+json,application/json;q=0.9,*/*;q=0.1"
      }
    });

    if (isRedirect(response.status)) {
      const location = response.headers.get("location");
      if (!location) throw new Error("Redirect response did not include a location");
      const nextUrl = new URL(location, firstUrl);
      parsePublicHttpUrl(nextUrl.toString());
      await assertPublicResolvable(nextUrl);
      return fetchText(nextUrl.toString(), options);
    }

    const contentLength = response.headers.get("content-length");
    if (contentLength && Number.parseInt(contentLength, 10) > options.maxBytes) {
      throw new Error("Response is too large");
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("Response body is empty");

    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > options.maxBytes) {
        throw new Error("Response exceeded maximum allowed size");
      }
      chunks.push(value);
    }

    const body = new TextDecoder("utf-8", { fatal: false }).decode(concat(chunks, total));
    return {
      url: response.url || firstUrl.toString(),
      status: response.status,
      headers: response.headers,
      body
    };
  } finally {
    clearTimeout(timeout);
  }
}

function isRedirect(status: number): boolean {
  return status >= 300 && status < 400;
}

function concat(chunks: Uint8Array[], total: number): Uint8Array {
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}
