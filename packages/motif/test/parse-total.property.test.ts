// Feature: motif-input, Property 1: parseMotif is total and deterministic
// For any string and any limit from 1 to 8, parseMotif returns a value (never throws), and two
// calls return deeply equal results.
// Validates: Requirements 4.8
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { parseMotif } from "../src/index.js";
import { motifDocArb, serializeMotif } from "./arbitraries.js";

const SEED = 4801;
const NUM_RUNS = 100;

/** Valid documents with a random edit: a slice removed, a string inserted, or a slice repeated. */
const mutatedArb = fc
  .record({
    svg: motifDocArb.map((doc) => serializeMotif(doc)),
    at: fc.nat(),
    length: fc.nat({ max: 40 }),
    insert: fc.oneof(fc.string({ maxLength: 12 }), fc.constantFrom("<", ">", "&", "&#x41;", '"', "<!--", "<?", "<![CDATA[", "</g>", "<g>", "=", "e", "-")),
    mode: fc.nat({ max: 2 }),
  })
  .map(({ svg, at, length, insert, mode }) => {
    const i = at % (svg.length + 1);
    if (mode === 0) return svg.slice(0, i) + svg.slice(i + length);
    if (mode === 1) return svg.slice(0, i) + insert + svg.slice(i);
    return svg.slice(0, i) + svg.slice(i, i + length).repeat(3) + svg.slice(i);
  });

const inputArb = fc.oneof(
  fc.string(),
  fc.string({ unit: "binary", maxLength: 200 }),
  motifDocArb.map((doc) => serializeMotif(doc)),
  mutatedArb,
  mutatedArb,
);

describe("Feature: motif-input, Property 1: parseMotif is total and deterministic", () => {
  it("never throws, returns a typed result and is deterministic for any string and limit 1 to 8", () => {
    fc.assert(
      fc.property(inputArb, fc.integer({ min: 1, max: 8 }), (svg, limit) => {
        let first: ReturnType<typeof parseMotif> | undefined;
        let second: ReturnType<typeof parseMotif> | undefined;
        expect(() => {
          first = parseMotif(svg, limit);
          second = parseMotif(svg, limit);
        }).not.toThrow();
        expect(first).toBeDefined();
        expect(typeof first!.ok).toBe("boolean");
        if (!first!.ok) expect(["MOTIF_SVG_INVALID", "MOTIF_TOO_MANY_COLOURS"]).toContain(first!.error.code);
        expect(second).toStrictEqual(first);
      }),
      { seed: SEED, numRuns: NUM_RUNS, verbose: 1 },
    );
  });
});
