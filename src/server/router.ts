import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { handleMatches, handleSports, handleStreams } from "../handlers/catalog.js";
import { resolveStream, getResolverStats, type ResolveInput } from "../handlers/resolve.js";
import { proxyHls } from "../proxy/hls.js";
import { checkCors, batchCheckCors } from "../proxy/cors.js";
import { corsOrigin } from "../config/site.js";

const clientDir = join(dirname(fileURLToPath(import.meta.url)), "../client");
let clientHtml = "";
try { clientHtml = readFileSync(join(clientDir, "index.html"), "utf8"); } catch { clientHtml = "<h1>Client not built</h1>"; }

const corsHeaders = {
  "Access-Control-Allow-Origin": corsOrigin,
  "Access-Control-Allow-Methods": "GET, POST, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
} as const;

function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    if (url.pathname === "/api/hls") return proxyHls(request);
    if (url.pathname === "/api/sports") return json(await handleSports());
    if (url.pathname === "/api/matches") {
      return json(await handleMatches(url.searchParams.get("sport"), url.searchParams.get("scope")));
    }
    if (url.pathname === "/api/streams") {
      return json(
        await handleStreams(
          url.searchParams.get("matchId"),
          url.searchParams.get("source"),
          url.searchParams.get("id"),
        ),
      );
    }
    if (url.pathname === "/api/resolve") {
      if (request.method !== "POST") return json({ error: "POST required" }, 405);
      let input: ResolveInput;
      try {
        input = ((await request.json()) ?? {}) as ResolveInput;
      } catch {
        return json({ ok: false, error: "invalid json" }, 400);
      }
      return json(await resolveStream(input, url.origin));
    }
    if (url.pathname === "/api/cors") {
      const targetUrl = url.searchParams.get("url");
      if (!targetUrl) return json({ error: "url param required" }, 400);
      const origin = url.searchParams.get("origin") ?? undefined;
      return json(await checkCors(targetUrl, origin));
    }
    if (url.pathname === "/api/cors/batch") {
      if (request.method !== "POST") return json({ error: "POST required" }, 405);
      let body: { urls: string[]; origin?: string };
      try {
        body = (await request.json()) as { urls: string[]; origin?: string };
      } catch {
        return json({ error: "invalid json" }, 400);
      }
      if (!Array.isArray(body.urls)) return json({ error: "urls array required" }, 400);
      return json(await batchCheckCors(body.urls, body.origin));
    }
    if (url.pathname === "/health") {
      return json({
        status: "ok",
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        resolver: getResolverStats(),
        timestamp: Date.now(),
      });
    }
    if (url.pathname === "/") {
      return new Response(getIndexHtml(), {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
    return json({ error: "not found" }, 404);
  } catch (err) {
    return json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      500,
    );
  }
}

function getIndexHtml(): string {
  return clientHtml;
}
