// Feature: motif-builder, Property 3: Every builder motif weaves within the float limit after auto-fix
// For any description, the design from motifToDesign(buildMotif(plan)) on the Default_Setup (repeat
// 48 by 48, minimum feature 2, the plan's colour count and symmetry, setup colour count 3) is
// accepted by buildLiftPlan with the web app's default weaves, PROFILE_240 and repeat across on;
// autoFix succeeds; and checkFloats on the fixed plan reports no violation.
// Validates: Requirements 2.7
import { PROFILE_240, autoFix, buildLiftPlan, checkFloats } from "@jacquard/engine";
import type { Weave, WeaveAssignment } from "@jacquard/engine";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { buildMotif, describeMotif, motifToDesign } from "../src/index.js";
import { descriptionArb, overridesArb } from "./builder-arbitraries.js";

const SEED = 6103;
const NUM_RUNS = 100;

/** The web app's default weaves (Default_Setup): region 0 plain, regions 1 and up cycle. */
const CYCLE: readonly Weave[] = [
  { kind: "twill", up: 1, down: 3, direction: "Z" },
  { kind: "satin", size: 5, move: 2, facing: "weft" },
  { kind: "twill", up: 3, down: 1, direction: "S" },
  { kind: "satin", size: 8, move: 3, facing: "warp" },
];
const DEFAULT_WEAVES: WeaveAssignment = Object.fromEntries(
  Array.from({ length: 8 }, (_, region) => [region, region === 0 ? { kind: "plain" } : CYCLE[(region - 1) % CYCLE.length]!]),
);

describe("Feature: motif-builder, Property 3: Every builder motif weaves within the float limit after auto-fix", () => {
  it("passes the float check after auto-fix on the default profile", () => {
    fc.assert(
      fc.property(descriptionArb, fc.oneof(fc.constant({}), overridesArb), (text, overrides) => {
        const { plan } = describeMotif(text, { colourCount: 3, maxColours: PROFILE_240.regionLimit, overrides });
        const svg = buildMotif(plan);
        const result = motifToDesign(svg, {
          colourCount: plan.colours.length,
          symmetry: plan.symmetry,
          repeat: { ends: 48, picks: 48 },
          minFeature: 2,
        });
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        const built = buildLiftPlan({ design: result.value.design, weaves: DEFAULT_WEAVES, profile: PROFILE_240, repeatAcross: true });
        expect(built.ok, built.ok ? "" : JSON.stringify(built.error)).toBe(true);
        if (!built.ok) return;
        const fixed = autoFix(built.value.plan, PROFILE_240);
        expect(fixed.ok, fixed.ok ? "" : `${JSON.stringify(plan)} ${fixed.error.code}`).toBe(true);
        if (!fixed.ok) return;
        const after = checkFloats(fixed.value.plan, PROFILE_240);
        expect(after.ok).toBe(true);
        if (after.ok) expect(after.value, JSON.stringify(plan)).toEqual([]);
      }),
      { seed: SEED, numRuns: NUM_RUNS, verbose: 1 },
    );
  });
});
