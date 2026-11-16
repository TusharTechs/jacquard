// Property 24: Auto-fix success leaves no violations.
// Feature: weave-engine, Property 24: Auto-fix success leaves no violations
// **Validates: Requirements 5.1**

import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

import { autoFix } from "../src/auto-fix.js"; // not exported from index until task 12.1
import { checkFloats } from "../src/index.js";

import { liftPlanArb, liftPlanFromDesignArb } from "./arbitraries.js";

const NUM_RUNS = 300;

function runProperty(name: string, arb: ReturnType<typeof liftPlanArb>): { ok: number; stuck: number } {
  const counts = { ok: 0, stuck: 0 };
  fc.assert(
    fc.property(arb, ({ plan, profile }) => {
      const result = autoFix(plan, profile);
      if (!result.ok) {
        // A failed fix is legitimate; any other error is not.
        if (result.error.code !== "AUTOFIX_FAILED") {
          throw new Error(`${name}: unexpected error ${result.error.code}`);
        }
        counts.stuck += 1;
        return;
      }
      counts.ok += 1;
      const floats = checkFloats(result.value.plan, profile);
      if (!floats.ok) throw new Error(`${name}: checkFloats failed: ${floats.error.code}`);
      expect(floats.value).toEqual([]);
    }),
    { numRuns: NUM_RUNS, verbose: true },
  );
  return counts;
}

describe("Property 24: Auto-fix success leaves no violations (5.1)", () => {
  it("checkFloats(result.plan) is empty whenever autoFix succeeds (random lift plans)", () => {
    const { ok, stuck } = runProperty("liftPlanArb", liftPlanArb());
    // Guard against a vacuous property: a meaningful share must be successes.
    expect(ok, `successes ${ok}, AUTOFIX_FAILED ${stuck}`).toBeGreaterThanOrEqual(NUM_RUNS * 0.2);
  });

  it("checkFloats(result.plan) is empty whenever autoFix succeeds (plans built from designs)", () => {
    const { ok, stuck } = runProperty("liftPlanFromDesignArb", liftPlanFromDesignArb());
    expect(ok, `successes ${ok}, AUTOFIX_FAILED ${stuck}`).toBeGreaterThanOrEqual(NUM_RUNS * 0.2);
  });
});
