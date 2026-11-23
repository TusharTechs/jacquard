// Feature: studio-experience, Property 8: Theme resolution
// For any stored value and system preference: a stored `daylight` or `after-hours` wins; any other
// stored value (missing, empty, unknown) falls back to `after-hours` when the system is dark and
// `daylight` otherwise.
// Validates: Requirements 1.4
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { THEMES, resolveTheme } from "../src/lib/theme";

const SEED = 8801;
const NUM_RUNS = 100;

const storedArb = fc.oneof(
  fc.constantFrom<string | null | undefined>(null, undefined, "", "Daylight", "after hours", "dark", "light"),
  fc.constantFrom(...THEMES),
  fc.string({ maxLength: 16 }),
);

describe("Feature: studio-experience, Property 8: Theme resolution", () => {
  it("a stored Theme wins, otherwise the system preference decides", () => {
    fc.assert(
      fc.property(storedArb, fc.boolean(), (stored, dark) => {
        const theme = resolveTheme(stored, dark);
        expect(THEMES).toContain(theme);
        if (stored === "daylight" || stored === "after-hours") expect(theme).toBe(stored);
        else expect(theme).toBe(dark ? "after-hours" : "daylight");
      }),
      { seed: SEED, numRuns: NUM_RUNS, verbose: 1 },
    );
  });
});
