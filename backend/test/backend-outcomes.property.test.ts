// Feature: motif-input, Property 13: Backend outcomes
//
// For any raw body and any injected generator behaviour (returns valid Motif_SVG, returns
// arbitrary text, returns SVG with too many colours, throws GeneratorUnavailable, throws any other
// value, never resolves), handleMotifRequest resolves to exactly one of the statuses 200, 400,
// 502, 503, 504, 500 as specified in Requirements 1 and 3; status 200 only when parseMotif accepts
// the returned SVG with the request's colourCount; the generator is not called when the body is
// invalid; and the serialised body never contains a planted secret string set in process.env, the
// generator's error message, or a stack trace.
//
// Validates: Requirements 1.2, 1.3, 1.4, 1.5, 2.3, 3.1, 3.2, 3.3, 3.4, 3.5, 13.4
import fc from "fast-check";
import { parseMotif, standInMotif, validateMotifRequest } from "@jacquard/motif";
import type { MotifRequest } from "@jacquard/motif";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { MockInstance } from "vitest";
import { GeneratorUnavailable, handleMotifRequest } from "../src/core.js";
import type { Generator } from "../src/core.js";

const SEED = 20261117;
const NUM_RUNS = 100;
const TIMEOUT_MS = 20;

const SECRET_ENV = "JACQUARD_PLANTED_SECRET";
const SECRET = "planted-secret-7c41e9b2-must-not-leak";

const STATUSES = [200, 400, 502, 503, 504, 500];
const INTERNAL_BODY = { code: "INTERNAL_ERROR", message: "Internal error." };

// ---------------------------------------------------------------------------------------------
// Bodies

const symmetryArb = fc.constantFrom("none", "mirrorEnds", "mirrorPicks", "mirrorBoth") as fc.Arbitrary<
  MotifRequest["symmetry"]
>;
const promptArb = fc
  .string({ minLength: 1, maxLength: 60, unit: "grapheme" })
  .filter((prompt) => prompt.trim().length > 0 && Array.from(prompt).length <= 500);
const sketchArb = fc
  .uint8Array({ minLength: 1, maxLength: 48 })
  .chain((bytes) =>
    fc.record({
      kind: fc.constant("sketch" as const),
      mediaType: fc.constantFrom("image/png" as const, "image/jpeg" as const),
      data: fc.constant(Buffer.from(bytes).toString("base64")),
    }),
  );
const validRequestArb: fc.Arbitrary<MotifRequest> = fc.record({
  input: fc.oneof(fc.record({ kind: fc.constant("text" as const), prompt: promptArb }), sketchArb),
  colourCount: fc.integer({ min: 2, max: 8 }),
  symmetry: symmetryArb,
  repeat: fc.record({ ends: fc.integer({ min: 8, max: 400 }), picks: fc.integer({ min: 8, max: 400 }) }),
});

type Corruption = (request: Record<string, unknown>) => void;
const CORRUPTIONS: readonly Corruption[] = [
  (r) => delete r["input"],
  (r) => delete r["colourCount"],
  (r) => delete r["symmetry"],
  (r) => delete r["repeat"],
  (r) => (r["input"] = { kind: "text", prompt: "   \n\t" }),
  (r) => (r["input"] = { kind: "text", prompt: "x".repeat(501) }),
  (r) => (r["input"] = { kind: "text", prompt: 42 }),
  (r) => (r["input"] = { kind: "drawing" }),
  (r) => (r["input"] = { kind: "sketch", mediaType: "image/gif", data: "AAAA" }),
  (r) => (r["input"] = { kind: "sketch", mediaType: "image/png", data: "not base64!" }),
  (r) => (r["input"] = { kind: "sketch", mediaType: "image/png", data: "A".repeat(2_000_004) }),
  (r) => (r["colourCount"] = 1),
  (r) => (r["colourCount"] = 9),
  (r) => (r["colourCount"] = 2.5),
  (r) => (r["colourCount"] = "4"),
  (r) => (r["symmetry"] = "rotate"),
  (r) => (r["repeat"] = { ends: 7, picks: 16 }),
  (r) => (r["repeat"] = { ends: 16, picks: 401 }),
  (r) => (r["repeat"] = [16, 16]),
];

const bodyArb: fc.Arbitrary<string | undefined> = fc.oneof(
  { arbitrary: validRequestArb.map((request) => JSON.stringify(request)), weight: 6 },
  {
    arbitrary: fc
      .tuple(validRequestArb, fc.integer({ min: 0, max: CORRUPTIONS.length - 1 }))
      .map(([request, index]) => {
        const copy = JSON.parse(JSON.stringify(request)) as Record<string, unknown>;
        CORRUPTIONS[index]?.(copy);
        return JSON.stringify(copy);
      }),
    weight: 2,
  },
  { arbitrary: fc.string(), weight: 1 },
  { arbitrary: fc.jsonValue().map((value) => JSON.stringify(value)), weight: 1 },
  { arbitrary: fc.constant(undefined), weight: 1 },
);

// ---------------------------------------------------------------------------------------------
// Generator behaviours

type Behaviour =
  | { kind: "valid" }
  | { kind: "text"; text: string }
  | { kind: "tooMany"; extra: number }
  | { kind: "unavailable"; sync: boolean }
  | { kind: "throws"; value: unknown; sync: boolean }
  | { kind: "never" };

const svgishTextArb = fc.oneof(
  fc.string(),
  fc.string().map((inner) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">${inner}</svg>`),
  fc.constantFrom(
    '<svg viewBox="0 0 10 10"><script>alert(1)</script></svg>',
    '<svg viewBox="0 0 10 10"><rect x="0" y="0" width="10" height="10" fill="red"/></svg>',
    '<svg viewBox="0 0 10 10"><rect x="0" y="0" width="10" height="10" fill="#123456"/><circle cx="5" cy="5" r="2" fill="#abc"/></svg>',
    '<!DOCTYPE svg><svg viewBox="0 0 10 10"/>',
  ),
);

const thrownArb: fc.Arbitrary<unknown> = fc.oneof(
  fc.anything(),
  fc.constant(new Error(`model failed: ${SECRET}`)),
  fc.constant(new TypeError(`bad: ${SECRET}`)),
  fc.string().map((text) => `${text}${SECRET}`),
  fc.constant({ name: "AccessDeniedException", message: SECRET }),
);

const behaviourArb: fc.Arbitrary<Behaviour> = fc.oneof(
  fc.constant({ kind: "valid" as const }),
  svgishTextArb.map((text) => ({ kind: "text" as const, text })),
  fc.integer({ min: 1, max: 3 }).map((extra) => ({ kind: "tooMany" as const, extra })),
  fc.boolean().map((sync) => ({ kind: "unavailable" as const, sync })),
  fc.tuple(thrownArb, fc.boolean()).map(([value, sync]) => ({ kind: "throws" as const, value, sync })),
  fc.constant({ kind: "never" as const }),
);

/** Motif_SVG with exactly `colours` distinct fills: a white background and colours - 1 rects. */
function svgWithColours(colours: number): string {
  const rects: string[] = ['<rect x="0" y="0" width="100" height="100" fill="#ffffff"/>'];
  for (let index = 1; index < colours; index += 1) {
    const hex = `#0000${index.toString(16).padStart(2, "0")}`;
    rects.push(`<rect x="${index * 5}" y="0" width="5" height="5" fill="${hex}"/>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${rects.join("")}</svg>`;
}

interface FakeGenerator extends Generator {
  calls: number;
  signal: AbortSignal | undefined;
}

function fakeGenerator(behaviour: Behaviour, source: Generator["source"]): FakeGenerator {
  const fake: FakeGenerator = {
    source,
    calls: 0,
    signal: undefined,
    generate(request, signal) {
      fake.calls += 1;
      fake.signal = signal;
      switch (behaviour.kind) {
        case "valid":
          return Promise.resolve(standInMotif(request));
        case "text":
          return Promise.resolve(behaviour.text);
        case "tooMany":
          return Promise.resolve(svgWithColours(request.colourCount + behaviour.extra));
        case "unavailable": {
          const failure = new GeneratorUnavailable(`throttled: ${SECRET}`);
          if (behaviour.sync) throw failure;
          return Promise.reject(failure);
        }
        case "throws":
          if (behaviour.sync) throw behaviour.value;
          return Promise.reject(behaviour.value);
        case "never":
          return new Promise<string>(() => undefined);
      }
    },
  };
  return fake;
}

function requestOf(body: string | undefined): { ok: true; value: MotifRequest } | { ok: false; field: string | undefined } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body ?? "");
  } catch {
    return { ok: false, field: "body" };
  }
  const validation = validateMotifRequest(parsed);
  return validation.ok ? validation : { ok: false, field: validation.error.field };
}

// ---------------------------------------------------------------------------------------------

describe("Feature: motif-input, Property 13: Backend outcomes", () => {
  let consoleError: MockInstance<typeof console.error>;
  beforeAll(() => {
    process.env[SECRET_ENV] = SECRET;
    consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterAll(() => {
    delete process.env[SECRET_ENV];
    consoleError.mockRestore();
  });

  it("maps every body and generator behaviour to exactly the specified outcome", async () => {
    const seen = new Set<number>();
    await fc.assert(
      fc.asyncProperty(
        bodyArb,
        behaviourArb,
        fc.constantFrom("model" as const, "standIn" as const),
        async (body, behaviour, source) => {
          const generator = fakeGenerator(behaviour, source);
          const result = await handleMotifRequest(body, { generator, timeoutMs: TIMEOUT_MS });
          seen.add(result.status);
          const serialised = JSON.stringify(result.body);
          const record = result.body as unknown as Record<string, unknown>;

          expect(STATUSES).toContain(result.status);
          // 2.3, 3.5: no planted secret, generator message or stack trace in any body.
          expect(serialised).not.toContain(SECRET);
          expect(serialised).not.toMatch(/\n\s+at /);
          expect(serialised).not.toMatch(/\bat .*\.(ts|js):\d+/);

          const expected = requestOf(body);
          if (!expected.ok) {
            // 1.3: invalid body, generator never called.
            expect(generator.calls).toBe(0);
            expect(result.status).toBe(400);
            expect(record["code"]).toBe("REQUEST_INVALID");
            expect(record["field"]).toBe(expected.field);
            expect(typeof record["message"]).toBe("string");
            return;
          }
          const request = expected.value;
          expect(generator.calls).toBe(1);

          // 13.4: 200 only when parseMotif accepts the SVG with the request's colourCount.
          if (result.status === 200) {
            const svg = record["svg"];
            expect(typeof svg).toBe("string");
            const parsed = parseMotif(svg as string, request.colourCount);
            expect(parsed.ok).toBe(true);
            if (parsed.ok) {
              // 1.2, 1.4, 1.5: same shape for both generators, palette from parseMotif.
              expect(result.body).toEqual({ svg, palette: [...parsed.value.palette], source });
              expect(parsed.value.palette.length).toBeGreaterThanOrEqual(2);
              expect(parsed.value.palette.length).toBeLessThanOrEqual(request.colourCount);
            }
          } else {
            // 3.2: a rejected SVG is never returned.
            expect(record).not.toHaveProperty("svg");
          }

          switch (behaviour.kind) {
            case "valid": {
              const svg = standInMotif(request);
              const parsed = parseMotif(svg, request.colourCount);
              expect(parsed.ok).toBe(true);
              if (parsed.ok) {
                expect(result.status).toBe(200);
                expect(result.body).toEqual({ svg, palette: [...parsed.value.palette], source });
              }
              break;
            }
            case "text": {
              const parsed = parseMotif(behaviour.text, request.colourCount);
              if (parsed.ok) {
                expect(result.status).toBe(200);
                expect(result.body).toEqual({ svg: behaviour.text, palette: [...parsed.value.palette], source });
              } else {
                // 3.2, 3.3: 502 with the first problem found.
                expect(result.status).toBe(502);
                expect(result.body).toEqual({ code: parsed.error.code, message: parsed.error.message });
              }
              break;
            }
            case "tooMany": {
              // 3.3: count found and limit in the message.
              const count = request.colourCount + behaviour.extra;
              expect(result.status).toBe(502);
              expect(record["code"]).toBe("MOTIF_TOO_MANY_COLOURS");
              expect(record["message"]).toContain(String(count));
              expect(record["message"]).toContain(String(request.colourCount));
              break;
            }
            case "unavailable":
              // 3.4
              expect(result.status).toBe(503);
              expect(record["code"]).toBe("MODEL_UNAVAILABLE");
              expect(Object.keys(record).sort()).toEqual(["code", "message"]);
              break;
            case "throws":
              // 3.5: fixed message.
              expect(result.status).toBe(500);
              expect(result.body).toEqual(INTERNAL_BODY);
              break;
            case "never":
              // 3.1: timeout, and the generator's signal is aborted.
              expect(result.status).toBe(504);
              expect(record["code"]).toBe("MODEL_TIMEOUT");
              expect(Object.keys(record).sort()).toEqual(["code", "message"]);
              expect(generator.signal?.aborted).toBe(true);
              break;
          }
        },
      ),
      { seed: SEED, numRuns: NUM_RUNS, verbose: 1 },
    );
    // The generated cases reach every outcome, so no branch above is vacuous.
    expect([...seen].sort((a, b) => a - b)).toEqual([...STATUSES].sort((a, b) => a - b));
  });
});
