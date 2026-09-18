import type { CorsCheckResult } from "../types/models.js";

const testOrigins = [
  "https://localhost:3000",
  "http://localhost:8080",
  "https://example.com",
];

export async function checkCors(url: string, origin?: string): Promise<CorsCheckResult> {
  const headers: Record<string, string> = {};

  try {
    const testOrigin = origin || testOrigins[0];
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Range: "bytes=0-0",
      },
      redirect: "follow",
    });

    for (const [key, value] of res.headers.entries()) {
      headers[key] = value;
    }

    const allowOrigin = res.headers.get("access-control-allow-origin");
    const allowMethods = res.headers.get("access-control-allow-methods");
    const exposeHeaders = res.headers.get("access-control-expose-headers");

    return {
      url,
      corsAllowed: !!(allowOrigin || allowMethods || exposeHeaders),
      headers,
    };
  } catch (err) {
    return {
      url,
      corsAllowed: false,
      headers,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function batchCheckCors(urls: string[], origin?: string): Promise<CorsCheckResult[]> {
  return Promise.all(urls.map((url) => checkCors(url, origin)));
}
