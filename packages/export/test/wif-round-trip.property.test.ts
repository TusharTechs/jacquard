// Feature: simulate-and-export, Property 3: WIF round trip
// For any valid plan, profile and yarns, readWif(writeWif(plan, profile, yarns)) returns a plan
// deeply equal to the original.
// Validates: Requirements 3.5, 3.2
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { readWif, writeWif } from "../src/index.js";
import { planCaseArb, yarnsArb } from "./arbitraries.js";

const SEED = 5103;
const NUM_RUNS = 100;

/** Titles that include newlines, brackets and INI-looking text, to try to break the file. */
const wifTitleArb = fc.option(
  fc.string({ unit: fc.constantFrom("a", " ", "\n", "\r", "[", "]", "=", ";", "LIFTPLAN", "THREADING", "1"), maxLength: 12 }),
  { nil: undefined },
);

describe("Feature: simulate-and-export, Property 3: WIF round trip", () => {
  it("reads back the lift plan it wrote", () => {
    fc.assert(
      fc.property(planCaseArb, yarnsArb, wifTitleArb, ({ plan, profile }, yarns, title) => {
        const written = writeWif(plan, profile, yarns, title === undefined ? {} : { title });
        expect(written.ok).toBe(true);
        if (!written.ok) return;
        const read = readWif(written.value);
        expect(read.ok, read.ok ? "" : JSON.stringify(read.error)).toBe(true);
        if (!read.ok) return;
        expect(read.value).toEqual(plan);
        // 3.2 the shape fields come back exactly.
        expect(read.value.hookCount).toBe(plan.hookCount);
        expect(read.value.pickCount).toBe(plan.pickCount);
        expect(read.value.designWidth).toBe(plan.designWidth);
        expect(read.value.repeatAcross).toBe(plan.repeatAcross);
      }),
      { seed: SEED, numRuns: NUM_RUNS, verbose: 1 },
    );
  });
});
