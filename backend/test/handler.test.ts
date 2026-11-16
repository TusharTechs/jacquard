// Lambda adapter examples (design.md, "Backend", handler.ts; Requirements 1.1, 1.5, 2.3).
import { parseMotif, standInMotif } from "@jacquard/motif";
import type { MotifRequest } from "@jacquard/motif";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createHandler, handler as envHandler, TIMEOUT_MS } from "../src/handler.js";
import type { Generator } from "../src/core.js";
import { createStandInGenerator } from "../src/stand-in-generator.js";

const REQUEST: MotifRequest = {
  input: { kind: "text", prompt: "a lotus border" },
  colourCount: 4,
  symmetry: "mirrorEnds",
  repeat: { ends: 24, picks: 32 },
};

function event(method: string, rawPath: string, body?: string, isBase64Encoded = false): APIGatewayProxyEventV2 {
  return {
    version: "2.0",
    routeKey: "$default",
    rawPath,
    rawQueryString: "",
    headers: { "content-type": "application/json", authorization: "Bearer should-not-be-echoed" },
    requestContext: {
      accountId: "123456789012",
      apiId: "api",
      domainName: "example.test",
      domainPrefix: "example",
      http: { method, path: rawPath, protocol: "HTTP/1.1", sourceIp: "127.0.0.1", userAgent: "vitest" },
      requestId: "id",
      routeKey: "$default",
      stage: "$default",
      time: "17/Nov/2026:00:00:00 +0000",
      timeEpoch: 0,
    },
    isBase64Encoded,
    ...(body === undefined ? {} : { body }),
  };
}

function countingGenerator(): Generator & { calls: number } {
  const inner = createStandInGenerator();
  const generator = {
    source: inner.source,
    calls: 0,
    generate(request: MotifRequest, signal: AbortSignal) {
      generator.calls += 1;
      return inner.generate(request, signal);
    },
  };
  return generator;
}

const HEADERS = { "content-type": "application/json", "cache-control": "no-store" };

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createHandler", () => {
  it("serves POST /api/motif with the stand-in and returns a validated motif", async () => {
    const generator = countingGenerator();
    const handle = createHandler({ generator, timeoutMs: TIMEOUT_MS });
    const result = await handle(event("POST", "/api/motif", JSON.stringify(REQUEST)));
    expect(result.statusCode).toBe(200);
    expect(result.headers).toEqual(HEADERS);
    const body = JSON.parse(result.body ?? "") as Record<string, unknown>;
    const svg = standInMotif(REQUEST);
    const parsed = parseMotif(svg, REQUEST.colourCount);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(body).toEqual({ svg, palette: [...parsed.value.palette], source: "standIn" });
    expect(generator.calls).toBe(1);
    expect(result.body).not.toContain("should-not-be-echoed");
    expect(result.body).not.toContain("123456789012");
  });

  it("accepts a stage prefix before /api/motif", async () => {
    const handle = createHandler({ generator: createStandInGenerator(), timeoutMs: TIMEOUT_MS });
    const result = await handle(event("POST", "/prod/api/motif", JSON.stringify(REQUEST)));
    expect(result.statusCode).toBe(200);
  });

  it("decodes a base64-encoded body", async () => {
    const handle = createHandler({ generator: createStandInGenerator(), timeoutMs: TIMEOUT_MS });
    const encoded = Buffer.from(JSON.stringify(REQUEST), "utf8").toString("base64");
    const result = await handle(event("POST", "/api/motif", encoded, true));
    expect(result.statusCode).toBe(200);
    expect((JSON.parse(result.body ?? "") as { svg: string }).svg).toBe(standInMotif(REQUEST));
  });

  it.each([
    ["GET", "/api/motif"],
    ["PUT", "/api/motif"],
    ["DELETE", "/api/motif"],
    ["OPTIONS", "/api/motif"],
    ["POST", "/api/motifs"],
    ["POST", "/api/motif/extra"],
    ["POST", "/"],
    ["POST", "/api"],
  ])("returns 404 REQUEST_INVALID for %s %s without calling the generator", async (method, path) => {
    const generator = countingGenerator();
    const handle = createHandler({ generator, timeoutMs: TIMEOUT_MS });
    const result = await handle(event(method, path, JSON.stringify(REQUEST)));
    expect(result.statusCode).toBe(404);
    expect(result.headers).toEqual(HEADERS);
    expect((JSON.parse(result.body ?? "") as { code: string }).code).toBe("REQUEST_INVALID");
    expect(generator.calls).toBe(0);
  });

  it("returns 400 with JSON headers for a missing body", async () => {
    const handle = createHandler({ generator: countingGenerator(), timeoutMs: TIMEOUT_MS });
    const result = await handle(event("POST", "/api/motif"));
    expect(result.statusCode).toBe(400);
    expect(result.headers).toEqual(HEADERS);
    expect(JSON.parse(result.body ?? "")).toMatchObject({ code: "REQUEST_INVALID", field: "body" });
  });

  it("builds lazily supplied dependencies once", async () => {
    const factory = vi.fn(() => ({ generator: createStandInGenerator(), timeoutMs: TIMEOUT_MS }));
    const handle = createHandler(factory);
    await handle(event("POST", "/api/motif", JSON.stringify(REQUEST)));
    await handle(event("POST", "/api/motif", JSON.stringify(REQUEST)));
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it("answers 500 with the fixed message when configuration fails, without echoing it", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const handle = createHandler(() => {
      throw new Error("config secret xyz");
    });
    const result = await handle(event("POST", "/api/motif", JSON.stringify(REQUEST)));
    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body ?? "")).toEqual({ code: "INTERNAL_ERROR", message: "Internal error." });
  });
});

describe("handler from the environment", () => {
  it("uses the stand-in when MOTIF_GENERATOR=standIn", async () => {
    // The environment handler resolves its generator on the first call, so set the variable first.
    vi.stubEnv("MOTIF_GENERATOR", "standIn");
    try {
      const result = await envHandler(event("POST", "/api/motif", JSON.stringify(REQUEST)));
      expect(result.statusCode).toBe(200);
      expect((JSON.parse(result.body ?? "") as { source: string }).source).toBe("standIn");
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
