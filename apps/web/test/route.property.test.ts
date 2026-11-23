// Feature: studio-experience, Property 9: Route round trip
// For every Step, parseHash(hrefFor({ page: "studio", step })) returns that Step; `#/` and the
// empty hash give the Story; `#/studio` and an unknown Step give Design; any other string gives a
// valid Route.
// Validates: Requirements 2.3, 10.5
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { STEPS, hrefFor, isStep, parseHash } from "../src/lib/route";

const SEED = 9902;
const NUM_RUNS = 100;

describe("Feature: studio-experience, Property 9: Route round trip", () => {
  it("every Step survives a round trip through its href", () => {
    fc.assert(
      fc.property(fc.constantFrom(...STEPS), (step) => {
        expect(parseHash(hrefFor({ page: "studio", step }))).toEqual({ page: "studio", step });
      }),
      { seed: SEED, numRuns: NUM_RUNS, verbose: 1 },
    );
  });

  it("the Story and the Design fallbacks", () => {
    for (const hash of ["", "#", "#/", "#/story", "#/nowhere"]) expect(parseHash(hash)).toEqual({ page: "story" });
    expect(parseHash(hrefFor({ page: "story" }))).toEqual({ page: "story" });
    for (const hash of ["#/studio", "#/studio/", "#studio", "#/studio/loom", "#/studio/DESIGN"]) {
      expect(parseHash(hash)).toEqual({ page: "studio", step: "design" });
    }
  });

  it("any string gives a valid Route", () => {
    fc.assert(
      fc.property(fc.oneof(fc.string(), fc.string().map((tail) => `#/studio/${tail}`)), (hash) => {
        const route = parseHash(hash);
        if (route.page === "studio") expect(isStep(route.step)).toBe(true);
        else expect(route).toEqual({ page: "story" });
      }),
      { seed: SEED, numRuns: NUM_RUNS, verbose: 1 },
    );
  });
});
