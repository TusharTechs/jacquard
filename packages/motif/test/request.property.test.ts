// Feature: motif-input, Property 12: Request validation
// For any JSON value, validateMotifRequest accepts it exactly when it matches 1.1 and the 1.3
// limits; for any valid request with one field corrupted (missing, wrong type, out of range, empty
// prompt, over-long prompt, oversized sketch), it rejects with REQUEST_INVALID naming that field.
// Validates: Requirements 1.1, 1.3
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { validateMotifRequest } from "../src/index.js";
import { motifRequestArb } from "./arbitraries.js";

const SEED = 4812;
const NUM_RUNS = 100;

// ---------------------------------------------------------------------------------------------
// Independent model of 1.1 and 1.3

const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function intIn(value: unknown, min: number, max: number): boolean {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}

function base64Bytes(data: string): number {
  const padding = data.endsWith("==") ? 2 : data.endsWith("=") ? 1 : 0;
  return (data.length / 4) * 3 - padding;
}

function modelAccepts(body: unknown): boolean {
  if (!isObject(body)) return false;
  const input = body["input"];
  if (!isObject(input)) return false;
  if (input["kind"] === "text") {
    const prompt = input["prompt"];
    if (typeof prompt !== "string" || prompt.trim() === "" || [...prompt].length > 500) return false;
  } else if (input["kind"] === "sketch") {
    if (input["mediaType"] !== "image/png" && input["mediaType"] !== "image/jpeg") return false;
    const data = input["data"];
    if (typeof data !== "string" || data === "" || !BASE64.test(data) || base64Bytes(data) > 1_500_000) return false;
  } else {
    return false;
  }
  if (!intIn(body["colourCount"], 2, 8)) return false;
  if (!["none", "mirrorEnds", "mirrorPicks", "mirrorBoth"].includes(body["symmetry"] as string)) return false;
  const repeat = body["repeat"];
  return isObject(repeat) && intIn(repeat["ends"], 8, 400) && intIn(repeat["picks"], 8, 400);
}

// ---------------------------------------------------------------------------------------------
// Corruptions

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

const MISSING: unique symbol = Symbol("missing");
type Missing = typeof MISSING;

interface Corruption {
  readonly field: string;
  /** Path from the body; the last key is set to `value` or deleted. */
  readonly path: readonly string[];
  readonly value: Json | Missing;
  /** Only applies to this input kind. */
  readonly kind?: "text" | "sketch";
}

const wrongTypes: readonly Json[] = [null, true, [], {}, "x", 3];

/** A base64 string that decodes to more than 1,500,000 bytes. */
function oversized(extraQuads: number): string {
  return "QUFB".repeat(500_000 + extraQuads);
}

const corruptionArb: fc.Arbitrary<Corruption> = fc.oneof<fc.Arbitrary<Corruption>[]>(
  fc.constantFrom<Json | Missing>(MISSING, null, 5, "text", []).map((value) => ({ field: "input", path: ["input"], value })),
  fc.constantFrom<Json | Missing>(MISSING, "image", "TEXT", 1, null).map((value) => ({ field: "input.kind", path: ["input", "kind"], value })),
  fc
    .oneof(
      fc.constantFrom<Json | Missing>(MISSING, null, 7, ["a"], ""),
      fc.constantFrom(" ", "\t\n", "   \r\n  ", "\u00a0", "\u2003"),
      fc.integer({ min: 501, max: 700 }).map((n) => "a".repeat(n)),
      // Over 500 code points of a character outside the BMP (two UTF-16 units each).
      fc.integer({ min: 501, max: 600 }).map((n) => "🦚".repeat(n)),
    )
    .map((value) => ({ field: "input.prompt", path: ["input", "prompt"], value, kind: "text" as const })),
  fc
    .constantFrom<Json | typeof MISSING>(MISSING, "image/gif", "image/PNG", "", 1, null)
    .map((value) => ({ field: "input.mediaType", path: ["input", "mediaType"], value, kind: "sketch" as const })),
  fc
    .oneof(
      fc.constantFrom<Json | Missing>(MISSING, null, 1, "", "abc", "ab=c", "a!bc", "===="),
      fc.integer({ min: 1, max: 3 }).map(oversized),
    )
    .map((value) => ({ field: "input.data", path: ["input", "data"], value, kind: "sketch" as const })),
  fc
    .constantFrom<Json | typeof MISSING>(MISSING, 1, 9, 0, -2, 2.5, "4", null, true)
    .map((value) => ({ field: "colourCount", path: ["colourCount"], value })),
  fc
    .constantFrom<Json | typeof MISSING>(MISSING, "mirror", "None", "", 0, null)
    .map((value) => ({ field: "symmetry", path: ["symmetry"], value })),
  fc.constantFrom<Json | Missing>(MISSING, null, 24, [24, 24], "24x24").map((value) => ({ field: "repeat", path: ["repeat"], value })),
  fc
    .constantFrom<Json | typeof MISSING>(MISSING, 7, 401, 0, 12.5, "12", null)
    .map((value) => ({ field: "repeat.ends", path: ["repeat", "ends"], value })),
  fc
    .constantFrom<Json | typeof MISSING>(MISSING, 7, 401, -8, 99.9, "99", false)
    .map((value) => ({ field: "repeat.picks", path: ["repeat", "picks"], value })),
);

function corrupt(body: Record<string, Json>, corruption: Corruption): Record<string, Json> {
  const copy = structuredClone(body);
  let target: Record<string, Json> = copy;
  for (const key of corruption.path.slice(0, -1)) target = target[key] as Record<string, Json>;
  const last = corruption.path[corruption.path.length - 1]!;
  if (corruption.value === MISSING) delete target[last];
  else target[last] = corruption.value;
  return copy;
}

const validBodyArb = fc
  .tuple(motifRequestArb, fc.dictionary(fc.constantFrom("extra", "model", "apiKey", "x"), fc.jsonValue(), { maxKeys: 2 }))
  .map(([request, extra]) => ({ ...(extra as Record<string, Json>), ...(request as unknown as Record<string, Json>) }));

const corruptedArb = fc
  .tuple(motifRequestArb, corruptionArb)
  .map(([request, corruption]) => {
    // Make the request's input kind match a kind-specific corruption.
    let body = request as unknown as Record<string, Json>;
    if (corruption.kind === "text" && request.input.kind !== "text") body = { ...body, input: { kind: "text", prompt: "lozenge" } };
    if (corruption.kind === "sketch" && request.input.kind !== "sketch") body = { ...body, input: { kind: "sketch", mediaType: "image/png", data: "iVBORw0K" } };
    return { body: corrupt(body, corruption), field: corruption.field };
  });

const anyJsonArb: fc.Arbitrary<unknown> = fc.oneof(
  fc.jsonValue(),
  validBodyArb,
  corruptedArb.map((c) => c.body),
  fc.record({ input: fc.jsonValue(), colourCount: fc.jsonValue(), symmetry: fc.jsonValue(), repeat: fc.jsonValue() }),
);

describe("Feature: motif-input, Property 12: Request validation", () => {
  it("accepts a JSON value exactly when it matches 1.1 and the 1.3 limits", () => {
    fc.assert(
      fc.property(anyJsonArb, (body) => {
        const result = validateMotifRequest(body);
        expect(result.ok).toBe(modelAccepts(body));
        if (result.ok) {
          const b = body as Record<string, Record<string, unknown>>;
          const input = b["input"]!;
          // Only the request fields are kept; extra fields are dropped at every level.
          expect(result.value).toEqual({
            input: input["kind"] === "text" ? { kind: "text", prompt: input["prompt"] } : { kind: "sketch", mediaType: input["mediaType"], data: input["data"] },
            colourCount: b["colourCount"],
            symmetry: b["symmetry"],
            repeat: { ends: b["repeat"]!["ends"], picks: b["repeat"]!["picks"] },
          });
        } else {
          expect(result.error.code).toBe("REQUEST_INVALID");
          expect(result.error.field).toBeTruthy();
          expect(result.error.message).toContain(result.error.field!);
        }
      }),
      { seed: SEED, numRuns: NUM_RUNS, verbose: 1 },
    );
  });

  it("rejects a valid request with one corrupted field, naming that field", () => {
    fc.assert(
      fc.property(corruptedArb, ({ body, field }) => {
        const result = validateMotifRequest(body);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.code).toBe("REQUEST_INVALID");
        expect(result.error.field).toBe(field);
        expect(result.error.message).toContain(field);
      }),
      { seed: SEED, numRuns: NUM_RUNS, verbose: 1 },
    );
  });
});
