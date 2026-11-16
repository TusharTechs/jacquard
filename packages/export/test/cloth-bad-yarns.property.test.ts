// Feature: simulate-and-export, Property 2: Cloth model rejects bad yarns
// For any valid plan and a yarn list that is empty or contains a non-#rrggbb string, clothModel
// returns YARN_INVALID; for a corrupted plan it returns the engine's PLAN_INVALID.
// Validates: Requirements 1.4
import * as fc from "fast-check";
import { validatePlan } from "@jacquard/engine";
import { describe, expect, it } from "vitest";
import { clothModel, writeWif } from "../src/index.js";
import { badYarnsArb, corruptCaseArb, planCaseArb, sideArb, yarnsArb } from "./arbitraries.js";

const SEED = 5102;
const NUM_RUNS = 100;

describe("Feature: simulate-and-export, Property 2: Cloth model rejects bad yarns", () => {
  it("returns YARN_INVALID and no cells for an empty or non-hex yarn list", () => {
    fc.assert(
      fc.property(planCaseArb, badYarnsArb, sideArb, ({ plan, profile }, yarns, side) => {
        const result = clothModel(plan, profile, yarns, side);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.code).toBe("YARN_INVALID");
        expect("value" in result).toBe(false);
        // The WIF writer shares the yarn check (design.md, Error Handling).
        const wif = writeWif(plan, profile, yarns);
        expect(wif.ok ? undefined : wif.error.code).toBe("YARN_INVALID");
      }),
      { seed: SEED, numRuns: NUM_RUNS, verbose: 1 },
    );
  });

  it("returns the engine's PLAN_INVALID, unchanged, for a corrupted plan", () => {
    fc.assert(
      fc.property(corruptCaseArb, yarnsArb, sideArb, ({ corrupted, profile }, yarns, side) => {
        const engine = validatePlan(corrupted, profile);
        expect(engine.ok).toBe(false);
        if (engine.ok) return;
        expect(engine.error.code).toBe("PLAN_INVALID");
        const result = clothModel(corrupted, profile, yarns, side);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error).toStrictEqual(engine.error);
      }),
      { seed: SEED, numRuns: NUM_RUNS, verbose: 1 },
    );
  });
});
