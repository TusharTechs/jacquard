// Feature: motif-input, Property 10: Pipeline output
// For any Stand_In request and any Minimum_Feature 1 to 8, motifToDesign(standInMotif(request),
// setup) succeeds with a design of exactly the repeat size, symmetric for the request's Symmetry,
// using region indices below colourCount, and the engine's buildLiftPlan accepts it with the web
// app's default weaves and a profile whose regionLimit is at least colourCount and whose hook
// count is at least the repeat width.
// Validates: Requirements 5.1, 7.6, 10.5, 11.1
import { buildLiftPlan, defineProfile } from "@jacquard/engine";
import type { Weave, WeaveAssignment } from "@jacquard/engine";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { motifToDesign, standInMotif } from "../src/index.js";
import { motifRequestArb } from "./arbitraries.js";
import { isSymmetric } from "./grid.js";

const SEED = 4810;
const NUM_RUNS = 100;

/** The web app's default weaves (10.5, Decision log): region 0 plain, regions 1 to 7 cycle. */
const CYCLE: readonly Weave[] = [
  { kind: "twill", up: 1, down: 3, direction: "Z" },
  { kind: "satin", size: 5, move: 2, facing: "weft" },
  { kind: "twill", up: 3, down: 1, direction: "S" },
  { kind: "satin", size: 8, move: 3, facing: "warp" },
];
const DEFAULT_WEAVES: WeaveAssignment = Object.fromEntries(
  Array.from({ length: 8 }, (_, region) => [region, region === 0 ? { kind: "plain" } : CYCLE[(region - 1) % CYCLE.length]!]),
);

describe("Feature: motif-input, Property 10: Pipeline output", () => {
  it("turns any stand-in motif into a repeat-sized, symmetric design the engine accepts", () => {
    fc.assert(
      fc.property(motifRequestArb, fc.integer({ min: 1, max: 8 }), (request, minFeature) => {
        const svg = standInMotif(request);
        const result = motifToDesign(svg, { colourCount: request.colourCount, symmetry: request.symmetry, repeat: request.repeat, minFeature });
        expect(result.ok, svg).toBe(true);
        if (!result.ok) return;
        const { design, palette } = result.value;
        expect(palette.length).toBeLessThanOrEqual(request.colourCount);
        expect(design.length).toBe(request.repeat.picks);
        for (const row of design) {
          expect(row.length).toBe(request.repeat.ends);
          for (const value of row) {
            expect(Number.isInteger(value) && value >= 0 && value < request.colourCount).toBe(true);
          }
        }
        expect(isSymmetric(design, request.symmetry)).toBe(true);
        const profile = defineProfile({ hookCount: Math.max(request.repeat.ends, 8), regionLimit: 8 });
        const plan = buildLiftPlan({ design, weaves: DEFAULT_WEAVES, profile, repeatAcross: false });
        expect(plan.ok, plan.ok ? "" : JSON.stringify(plan.error)).toBe(true);
      }),
      { seed: SEED, numRuns: NUM_RUNS, verbose: 1 },
    );
  }, 60_000);
});
