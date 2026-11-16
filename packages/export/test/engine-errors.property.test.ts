// Feature: simulate-and-export, Property 11: Engine errors pass through
// For any invalid custom profile, writeWif, cardSheetSvg and cardSheetPdf return the same
// PROFILE_INVALID error as the engine's validateProfile; for a valid profile and a corrupted plan
// they return the same error as validatePlan or buildCards; both unchanged. The profile is checked
// first (finding from task 2.3), so an invalid profile wins over any plan problem.
// Validates: Requirements 4.8
import * as fc from "fast-check";
import { buildCards, validatePlan, validateProfile } from "@jacquard/engine";
import { describe, expect, it } from "vitest";
import { cardSheetLayout, cardSheetPdf, cardSheetSvg, clothModel, writeWif } from "../src/index.js";
import { badProfileCaseArb, corruptCaseArb, yarnsArb } from "./arbitraries.js";
import type { LiftPlan, LoomProfile } from "@jacquard/engine";
import type { YarnColours } from "./arbitraries.js";

const SEED = 5111;
const NUM_RUNS = 100;

function allExports(plan: LiftPlan, profile: LoomProfile, yarns: YarnColours) {
  return {
    writeWif: writeWif(plan, profile, yarns),
    cardSheetSvg: cardSheetSvg(plan, profile),
    cardSheetPdf: cardSheetPdf(plan, profile),
    cardSheetLayout: cardSheetLayout(plan, profile),
    clothModel: clothModel(plan, profile, yarns, "face"),
  };
}

describe("Feature: simulate-and-export, Property 11: Engine errors pass through", () => {
  it("returns validateProfile's PROFILE_INVALID unchanged for an invalid profile, with a valid or corrupted plan", () => {
    fc.assert(
      fc.property(badProfileCaseArb, yarnsArb, fc.boolean(), ({ plan, badProfile }, yarns, corruptToo) => {
        const engine = validateProfile(badProfile);
        expect(engine.ok).toBe(false);
        if (engine.ok) return;
        expect(engine.error.code).toBe("PROFILE_INVALID");
        // Profile first: even a plan that also fails validatePlan gives the profile error.
        const usedPlan = corruptToo ? { ...plan, pickCount: 0 } : plan;
        for (const [name, result] of Object.entries(allExports(usedPlan, badProfile, yarns))) {
          expect(result.ok, name).toBe(false);
          if (result.ok) continue;
          expect(result.error, name).toStrictEqual(engine.error);
        }
      }),
      { seed: SEED, numRuns: NUM_RUNS, verbose: 1 },
    );
  });

  it("returns validatePlan's and buildCards' error unchanged for a corrupted plan", () => {
    fc.assert(
      fc.property(corruptCaseArb, yarnsArb, ({ corrupted, profile }, yarns) => {
        const engine = validatePlan(corrupted, profile);
        const cards = buildCards(corrupted, profile);
        expect(engine.ok || cards.ok).toBe(false);
        if (engine.ok || cards.ok) return;
        expect(cards.error).toStrictEqual(engine.error);
        for (const [name, result] of Object.entries(allExports(corrupted, profile, yarns))) {
          expect(result.ok, name).toBe(false);
          if (result.ok) continue;
          expect(result.error, name).toStrictEqual(engine.error);
        }
      }),
      { seed: SEED, numRuns: NUM_RUNS, verbose: 1 },
    );
  });
});
