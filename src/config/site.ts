export const port = Number(process.env.PORT ?? "3000");

export const streamedOrigin = process.env.STREAMED_ORIGIN ?? "https://streamed.pk";

export const embedOrigin = process.env.EMBED_ORIGIN ?? "https://embed.st";

export const userAgent =
  process.env.USER_AGENT ??
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export const corsOrigin = process.env.CORS_ORIGIN ?? "*";

export const cacheTtlMs = Number(process.env.CACHE_TTL_MS ?? "60000");

export const maxConcurrentResolves = Number(process.env.MAX_CONCURRENT_RESOLVES ?? "50");
