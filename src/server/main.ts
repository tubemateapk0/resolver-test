import { createServer, type IncomingMessage } from "node:http";
import { Readable } from "node:stream";

import { port } from "../config/site.js";
import { handleRequest } from "./router.js";

const server = createServer(async (incoming, outgoing) => {
  try {
    const host = incoming.headers.host ?? `localhost:${port}`;
    const headers = new Headers();
    for (const [key, value] of Object.entries(incoming.headers)) {
      if (typeof value === "string") headers.set(key, value);
      else if (Array.isArray(value)) {
        for (const item of value) headers.append(key, item);
      }
    }

    let body: Buffer | undefined;
    if (incoming.method !== "GET" && incoming.method !== "HEAD") {
      const chunks: Buffer[] = [];
      for await (const chunk of incoming) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      body = Buffer.concat(chunks);
    }

    const abort = new AbortController();
    outgoing.on("close", () => {
      if (!outgoing.writableFinished) abort.abort();
    });

    const init: RequestInit = {
      method: incoming.method ?? "GET",
      headers,
      signal: abort.signal,
    };
    if (body && body.length) init.body = new Uint8Array(body);

    const request = new Request(`http://${host}${incoming.url ?? "/"}`, init);
    const response = await handleRequest(request);

    if (outgoing.writableEnded || abort.signal.aborted) return;

    outgoing.statusCode = response.status;
    response.headers.forEach((value, key) => outgoing.setHeader(key, value));

    if (!response.body) {
      outgoing.end();
      return;
    }

    const nodeBody = Readable.fromWeb(response.body as import("node:stream/web").ReadableStream);
    nodeBody.on("error", () => {
      if (!outgoing.writableEnded) outgoing.destroy();
    });
    outgoing.on("close", () => {
      nodeBody.destroy();
    });
    nodeBody.pipe(outgoing);
  } catch (error) {
    if (outgoing.writableEnded) return;
    outgoing.statusCode = 500;
    outgoing.end(error instanceof Error ? error.message : "internal error");
  }
});

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Health check: http://localhost:${port}/health`);
});

const shutdown = () => {
  console.log("Shutting down...");
  server.close(() => {
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
