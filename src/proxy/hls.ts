import { relayLink } from "./media.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Expose-Headers": "*",
  "Cache-Control": "no-store",
} as const;

function absUri(uri: string, base: string): string {
  return uri.startsWith("http") ? uri : new URL(uri, base).href;
}

function isPlaylist(body: string): boolean {
  return body.includes("#EXTM3U");
}

function rewrite(text: string, base: string, referer: string, origin: string): string {
  return text
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (trimmed.startsWith("#")) {
        if (!trimmed.includes('URI="')) return line;
        return trimmed.replace(/URI="([^"]+)"/g, (_, uri: string) => `URI="${relayLink(origin, absUri(uri, base), referer)}"`);
      }
      return relayLink(origin, absUri(trimmed, base), referer);
    })
    .join("\n");
}

export async function proxyHls(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(request.url);
  const target = url.searchParams.get("url");
  const referer = url.searchParams.get("referer");
  if (!target || !referer) {
    return new Response(JSON.stringify({ error: "url and referer required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const res = await fetch(target, {
      headers: {
        Referer: referer,
        Origin: new URL(referer).origin,
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      },
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ error: `upstream ${res.status}` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await res.text();

    if (isPlaylist(body)) {
      return new Response(rewrite(body, target, referer, url.origin), {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/vnd.apple.mpegurl",
        },
      });
    }

    return new Response(body, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": res.headers.get("Content-Type") || "application/octet-stream",
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}
