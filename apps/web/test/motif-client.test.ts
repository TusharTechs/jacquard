// motif-client: request checks, backend error mapping, network, offline and cancel (3.6, 3.7, 2.1).
import { standInMotif } from "@jacquard/motif";
import type { MotifRequest } from "@jacquard/motif";
import { afterEach, describe, expect, it, vi } from "vitest";
import { requestMotif } from "../src/lib/motif-client";

const REQUEST: MotifRequest = {
  input: { kind: "text", prompt: "a lozenge border" },
  colourCount: 3,
  symmetry: "mirrorEnds",
  repeat: { ends: 48, picks: 48 },
};

interface FakeAnswer {
  status: number;
  body: unknown;
}

function fakeFetch(answer: FakeAnswer | (() => Promise<never>)) {
  return vi.fn((_url: string, _init?: RequestInit): Promise<Response> => {
    if (typeof answer === "function") return answer();
    const text = typeof answer.body === "string" ? answer.body : JSON.stringify(answer.body);
    return Promise.resolve({
      ok: answer.status >= 200 && answer.status < 300,
      status: answer.status,
      text: () => Promise.resolve(text),
    } as Response);
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("requestMotif", () => {
  it("returns the response on success and posts JSON to /api/motif", async () => {
    const svg = standInMotif(REQUEST);
    const fetchImpl = fakeFetch({ status: 200, body: { svg, palette: ["#ffffff", "#8c2f39", "#2f4b7c"], source: "standIn" } });
    const result = await requestMotif(REQUEST, { fetchImpl: fetchImpl as unknown as typeof fetch, baseUrl: "https://api.example.test/" });
    expect(result).toEqual({ ok: true, response: { svg, palette: ["#ffffff", "#8c2f39", "#2f4b7c"], source: "standIn" } });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("https://api.example.test/api/motif");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body as string)).toEqual(REQUEST);
  });

  it("uses a same-origin path when no base URL is set", async () => {
    const fetchImpl = fakeFetch({ status: 200, body: { svg: standInMotif(REQUEST), palette: [], source: "standIn" } });
    await requestMotif(REQUEST, { fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(fetchImpl.mock.calls[0]![0]).toBe("/api/motif");
  });

  const errorCases: readonly [string, number, string][] = [
    ["MODEL_TIMEOUT", 504, "model"],
    ["MODEL_UNAVAILABLE", 503, "model"],
    ["INTERNAL_ERROR", 500, "model"],
    ["MOTIF_SVG_INVALID", 502, "invalidMotif"],
    ["MOTIF_TOO_MANY_COLOURS", 502, "invalidMotif"],
    ["REQUEST_INVALID", 400, "request"],
  ];
  for (const [code, status, kind] of errorCases) {
    it(`maps ${code} to ${kind}`, async () => {
      const fetchImpl = fakeFetch({ status, body: { code, message: "backend text at /var/task/handler.js:12", field: "input.prompt" } });
      const result = await requestMotif(REQUEST, { fetchImpl: fetchImpl as unknown as typeof fetch });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.failure.kind).toBe(kind);
      expect(result.failure.code).toBe(code);
      expect(result.failure.message).not.toContain("/var/task");
      expect(result.failure.message.length).toBeGreaterThan(10);
    });
  }

  it("maps an error answer that is not a Motif_Error to network", async () => {
    const fetchImpl = fakeFetch({ status: 502, body: "<html>Bad gateway</html>" });
    const result = await requestMotif(REQUEST, { fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(result.ok === false && result.failure.kind).toBe("network");
  });

  it("maps a fetch rejection to network", async () => {
    const fetchImpl = fakeFetch(() => Promise.reject(new TypeError("Failed to fetch")));
    const result = await requestMotif(REQUEST, { fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.kind).toBe("network");
    expect(result.failure.message).not.toContain("Failed to fetch");
  });

  it("maps a fetch rejection while offline to offline", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    const fetchImpl = fakeFetch(() => Promise.reject(new TypeError("Failed to fetch")));
    const result = await requestMotif(REQUEST, { fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(result.ok === false && result.failure.kind).toBe("offline");
  });

  it("returns cancelled when the caller aborts, even if fetch ignores the signal", async () => {
    const controller = new AbortController();
    const fetchImpl = fakeFetch(() => new Promise<never>(() => {}));
    const pending = requestMotif(REQUEST, { fetchImpl: fetchImpl as unknown as typeof fetch, signal: controller.signal });
    controller.abort();
    const result = await pending;
    expect(result.ok === false && result.failure.kind).toBe("cancelled");
    const [, init] = fetchImpl.mock.calls[0]!;
    expect(init?.signal?.aborted).toBe(true);
  });

  it("returns cancelled without fetching when the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchImpl = fakeFetch({ status: 200, body: {} });
    const result = await requestMotif(REQUEST, { fetchImpl: fetchImpl as unknown as typeof fetch, signal: controller.signal });
    expect(result.ok === false && result.failure.kind).toBe("cancelled");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("maps the client timeout to network, not cancelled", async () => {
    const fetchImpl = fakeFetch(() => new Promise<never>(() => {}));
    const result = await requestMotif(REQUEST, { fetchImpl: fetchImpl as unknown as typeof fetch, timeoutMs: 10 });
    expect(result.ok === false && result.failure.kind).toBe("network");
  });

  it("never calls fetch for an invalid request", async () => {
    const fetchImpl = fakeFetch({ status: 200, body: {} });
    const result = await requestMotif({ ...REQUEST, input: { kind: "text", prompt: "   " } }, { fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.kind).toBe("request");
    expect(result.failure.code).toBe("REQUEST_INVALID");
  });

  it("maps a 200 whose svg fails parseMotif to invalidMotif", async () => {
    const fetchImpl = fakeFetch({ status: 200, body: { svg: '<svg viewBox="0 0 10 10"><script/></svg>', palette: ["#ffffff"], source: "model" } });
    const result = await requestMotif(REQUEST, { fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.kind).toBe("invalidMotif");
    expect(result.failure.code).toBe("MOTIF_SVG_INVALID");
  });

  it("maps a 200 with too many colours for the request to invalidMotif", async () => {
    const svg = standInMotif({ ...REQUEST, colourCount: 6 });
    const fetchImpl = fakeFetch({ status: 200, body: { svg, palette: [], source: "model" } });
    const result = await requestMotif(REQUEST, { fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(result.ok === false && result.failure.code).toBe("MOTIF_TOO_MANY_COLOURS");
  });
});
