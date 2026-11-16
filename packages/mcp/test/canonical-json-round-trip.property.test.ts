// Feature: weave-mcp, Property 5: Canonical_JSON round trip and idempotence
// Validates: Requirements 11.4
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { canonicalJson } from "../src/canonical-json.js";

const SEED = 5005;
const NUM_RUNS = 100;

/** A JSON-like value that may hold undefined members, which JSON drops. */
const withUndefinedArb = fc.letrec((tie) => ({
  value: fc.oneof(
    { depthSize: "small" },
    fc.jsonValue({ maxDepth: 1 }),
    fc.array(tie("value"), { maxLength: 4 }),
    fc.dictionary(fc.string({ maxLength: 4 }), fc.oneof(tie("value"), fc.constant(undefined)), { maxKeys: 4 }),
  ),
})).value;

describe("Feature: weave-mcp, Property 5: Canonical_JSON round trip and idempotence", () => {
  it("parses back to the same value and is a fixed point", () => {
    fc.assert(
      fc.property(fc.oneof(fc.jsonValue(), withUndefinedArb), (value) => {
        const text = canonicalJson(value);
        // JSON.stringify defines what "the same value with undefined members dropped" is.
        const viaJson: unknown = JSON.parse(JSON.stringify(value) ?? "null");
        expect(JSON.parse(text)).toStrictEqual(viaJson);
        expect(canonicalJson(JSON.parse(text))).toBe(text);
      }),
      { seed: SEED, numRuns: NUM_RUNS, verbose: 1 },
    );
  });
});
