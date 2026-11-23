// Feature: studio-experience, Property 7: Step route round trip
// For every Step, parseStep(stepHref(step)) is that Step; any other hash, including the empty one,
// gives Design.
// Validates: Requirements 2.3
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { STEPS, isStep, parseStep, stepHref } from "../src/lib/route";

const SEED = 9902;
const NUM_RUNS = 100;

describe("Feature: studio-experience, Property 7: Step route round trip", () => {
  it("every Step survives a round trip through its href", () => {
    fc.assert(
      fc.property(fc.constantFrom(...STEPS), (step) => {
        expect(parseStep(stepHref(step))).toBe(step);
      }),
      { seed: SEED, numRuns: NUM_RUNS, verbose: 1 },
    );
  });

  it("any other hash gives Design", () => {
    for (const hash of ["", "#", "#/", "#/loom", "#/DESIGN", "#/studio/check"]) expect(parseStep(hash)).toBe("design");
    fc.assert(
      fc.property(fc.string(), (hash) => {
        const step = parseStep(hash);
        expect(isStep(step)).toBe(true);
        const name = hash.replace(/^#/, "").replace(/^\/+/, "").replace(/\/+$/, "");
        if (!isStep(name)) expect(step).toBe("design");
      }),
      { seed: SEED, numRuns: NUM_RUNS, verbose: 1 },
    );
  });
});
