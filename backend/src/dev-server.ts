// Local development server for POST /api/motif (design.md, "Local development"). Not deployed.
// Listens on 127.0.0.1:8787 (or PORT) and uses the Stand_In unless MOTIF_GENERATOR=bedrock.
import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { handleMotifRequest } from "./core.js";
import type { HandlerDeps, HttpResult } from "./core.js";
import { generatorFromEnv } from "./generator-from-env.js";
import { isMotifRoute, TIMEOUT_MS } from "./handler.js";

const HOST = "127.0.0.1";
const DEFAULT_PORT = 8787;
/** Largest body read [decision]: a 1,500,000-byte sketch is 2,000,000 base64 characters. */
const MAX_BODY_BYTES = 3_000_000;

function send(response: ServerResponse, result: HttpResult): void {
  response.writeHead(result.status, { "content-type": "application/json", "cache-control": "no-store" });
  response.end(JSON.stringify(result.body));
}

function readBody(request: IncomingMessage): Promise<string | undefined> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    request.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        resolve(undefined);
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

function parsePort(value: string | undefined): number {
  if (value === undefined || value.trim() === "") return DEFAULT_PORT;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT must be an integer from 1 to 65535.");
  return port;
}

const deps: HandlerDeps = { generator: generatorFromEnv(process.env, "standIn"), timeoutMs: TIMEOUT_MS };
const port = parsePort(process.env["PORT"]);

const server = createServer((request, response) => {
  const path = (request.url ?? "").split("?")[0];
  if (!isMotifRoute(request.method, path)) {
    send(response, { status: 404, body: { code: "REQUEST_INVALID", field: "path", message: "Only POST /api/motif is served." } });
    return;
  }
  readBody(request)
    .then(async (body) => {
      if (body === undefined) {
        send(response, { status: 400, body: { code: "REQUEST_INVALID", field: "body", message: "Request body is too large." } });
        return;
      }
      send(response, await handleMotifRequest(body, deps));
    })
    .catch((caught: unknown) => {
      console.error("[motif] dev server failed", caught);
      if (!response.headersSent) send(response, { status: 500, body: { code: "INTERNAL_ERROR", message: "Internal error." } });
    });
});

server.listen(port, HOST, () => {
  process.stderr.write(`motif dev server (${deps.generator.source}) listening on http://${HOST}:${port}/api/motif\n`);
});
