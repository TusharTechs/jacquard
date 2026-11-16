// Feature: motif-input, Property 11: Stand_In
// For any valid Motif_Request, standInMotif returns the same text on two calls, the text passes
// parseMotif with colourCount as the limit, and the palette has exactly colourCount entries. Over
// generated prompts, at least four families appear.
// Validates: Requirements 8.1, 8.2, 8.3, 8.4
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { STAND_IN_FAMILIES, parseMotif, standInMotif } from "../src/index.js";
import { motifRequestArb } from "./arbitraries.js";

const SEED = 4811;
const NUM_RUNS = 100;

describe("Feature: motif-input, Property 11: Stand_In", () => {
  it("is deterministic, passes parseMotif and uses exactly colourCount colours; four or more families appear", () => {
    const seen = new Set<string>();
    fc.assert(
      fc.property(motifRequestArb, (request) => {
        const svg = standInMotif(request);
        // Same request (a structural copy, not the same object) gives byte-identical text (8.2).
        expect(standInMotif(structuredClone(request))).toBe(svg);
        const parsed = parseMotif(svg, request.colourCount);
        expect(parsed.ok, svg).toBe(true);
        if (!parsed.ok) return;
        expect(parsed.value.palette).toHaveLength(request.colourCount);
        const family = /<title>Stand-in motif: ([a-z]+)<\/title>/.exec(svg)?.[1];
        expect(family, svg).toBeDefined();
        expect(STAND_IN_FAMILIES).toContain(family);
        seen.add(family!);
      }),
      { seed: SEED, numRuns: NUM_RUNS, verbose: 1 },
    );
    expect(seen.size, [...seen].join(", ")).toBeGreaterThanOrEqual(4);
  });
});
