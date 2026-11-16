// Property 30: Never partly fixed.
// Feature: weave-engine, Property 30: Never partly fixed
// **Validates: Requirements 5.8**

import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

import { autoFix } from "../src/auto-fix.js"; // not exported from index until task 12.1
import { checkFloats } from "../src/index.js";

import { liftPlanArb, liftPlanFromDesignArb } from "./arbitraries.js";

const NUM_RUNS = 300;

type Arb = ReturnType<typeof liftPlanArb>;

function runProperty(arb: Arb): { ok: number; failed: number } {
  const counts = { ok: 0, failed: 0 };
  fc.assert(
    fc.property(arb, fc.integer({ min: 0, max: 40 }), ({ plan, profile }, maxIterations) => {
      const result = autoFix(plan, profile, { maxIterations });
      if (result.ok) {
        counts.ok += 1;
        const floats = checkFloats(result.value.plan, profile);
        if (!floats.ok) throw new Error(`checkFloats failed: ${floats.error.code}`);
        expect(floats.value).toEqual([]);
        return;
      }
      counts.failed += 1;
      const error = result.error;
      if (error.code !== "AUTOFIX_FAILED") throw new Error(`unexpected error ${error.code}`);
      expect(error.remaining.length).toBeGreaterThan(0);
      expect("value" in result).toBe(false);
      expect("plan" in error).toBe(false);
    }),
    { numRuns: NUM_RUNS, verbose: true },
  );
  return counts;
}

function runZeroIterations(arb: Arb): number {
  let withViolations = 0;
  fc.assert(
    fc.property(arb, ({ plan, profile }) => {
      const before = checkFloats(plan, profile);
      if (!before.ok) throw new Error(`checkFloats failed: ${before.error.code}`);
      const result = autoFix(plan, profile, { maxIterations: 0 });
      if (before.value.length === 0) {
        expect(result.ok).toBe(true);
        return;
      }
      withViolations += 1;
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("AUTOFIX_FAILED");
        if (result.error.code === "AUTOFIX_FAILED") {
          expect(result.error.remaining.length).toBeGreaterThan(0);
        }
      }
    }),
    { numRuns: NUM_RUNS, verbose: true },
  );
  return withViolations;
}

describe("Property 30: Never partly fixed (5.8)", () => {
  it("result is a clean plan or AUTOFIX_FAILED with remaining violations and no plan (random lift plans)", () => {
    const { ok, failed } = runProperty(liftPlanArb());
    expect(ok + failed).toBe(NUM_RUNS);
    expect(failed, `successes ${ok}, failures ${failed}`).toBeGreaterThan(0);
  });

  it("result is a clean plan or AUTOFIX_FAILED with remaining violations and no plan (plans built from designs)", () => {
    const { ok, failed } = runProperty(liftPlanFromDesignArb());
    expect(ok + failed).toBe(NUM_RUNS);
  });

  it("maxIterations = 0 on a plan with violations always fails with AUTOFIX_FAILED", () => {
    const withViolations = runZeroIterations(liftPlanArb());
    expect(withViolations).toBeGreaterThan(0);
  });
});
