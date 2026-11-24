// Feature: motif-builder, Property 1: Describer totality and determinism
// For any text, options and overrides, describeMotif does not throw, returns a plan whose subject,
// layout, size and symmetry are known values, whose count is in the subject's range (or null exactly
// when the subject has none), whose colours are 2 to min(4, maxColours) distinct lower-case #rrggbb
// values, and whose every understood phrase is a run of words of the text; a second call with
// structural copies returns a deep-equal result; every override given is reflected in the plan
// (a symmetry without its top-to-bottom part for a figure that is not symmetric that way).
// Validates: Requirements 1.3, 1.4, 1.6, 1.7
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  BUILDER_COLOURS,
  BUILDER_LAYOUTS,
  BUILDER_SIZES,
  BUILDER_SUBJECTS,
  BUILDER_SYMMETRIES,
  COUNT_RANGES,
  describeMotif,
  picksSymmetric,
} from "../src/index.js";
import { descriptionArb, optionsArb } from "./builder-arbitraries.js";

const SEED = 6101;
const NUM_RUNS = 100;

function words(text: string): string {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word !== "")
    .join(" ");
}

describe("Feature: motif-builder, Property 1: Describer totality and determinism", () => {
  it("gives a valid, repeatable plan for any text, options and overrides", () => {
    fc.assert(
      fc.property(descriptionArb, optionsArb, (text, options) => {
        const result = describeMotif(text, options);
        const { plan } = result;
        expect(BUILDER_SUBJECTS).toContain(plan.subject);
        expect(BUILDER_LAYOUTS).toContain(plan.layout);
        expect(BUILDER_SIZES).toContain(plan.size);
        expect(BUILDER_SYMMETRIES).toContain(plan.symmetry);
        const range = COUNT_RANGES[plan.subject];
        if (range === undefined) {
          expect(plan.count).toBeNull();
        } else {
          expect(Number.isInteger(plan.count)).toBe(true);
          expect(plan.count!).toBeGreaterThanOrEqual(range.min);
          expect(plan.count!).toBeLessThanOrEqual(range.max);
        }
        const limit = Math.min(4, Math.max(2, options.maxColours ?? 4));
        expect(plan.colours.length).toBeGreaterThanOrEqual(2);
        expect(plan.colours.length).toBeLessThanOrEqual(limit);
        const hexes = plan.colours.map((colour) => colour.hex);
        for (const hex of hexes) expect(hex).toMatch(/^#[0-9a-f]{6}$/);
        expect(new Set(hexes).size).toBe(hexes.length);

        // Understood phrases come from the text (1.3).
        const padded = ` ${words(text)} `;
        for (const phrase of result.understood) expect(padded, phrase).toContain(` ${phrase} `);
        if (result.fellBack) expect(plan.subject).toBe(options.overrides?.subject ?? "rosette");

        // Determinism (1.4): structural copies give a deep-equal result.
        expect(describeMotif(`${text}`, structuredClone(options))).toEqual(result);

        // Overrides (1.7).
        const overrides = options.overrides ?? {};
        if (overrides.subject !== undefined) expect(plan.subject).toBe(overrides.subject);
        if (overrides.layout !== undefined) expect(plan.layout).toBe(overrides.layout);
        if (overrides.size !== undefined) expect(plan.size).toBe(overrides.size);
        if (overrides.symmetry !== undefined) {
          // A figure that is not symmetric top to bottom keeps only the left-right part (2.5).
          const expected = picksSymmetric(plan.subject, plan.count)
            ? overrides.symmetry
            : overrides.symmetry === "mirrorBoth"
              ? "mirrorEnds"
              : overrides.symmetry === "mirrorPicks"
                ? "none"
                : overrides.symmetry;
          expect(plan.symmetry).toBe(expected);
        }
        if (overrides.count !== undefined && range !== undefined) {
          expect(plan.count).toBe(Math.min(range.max, Math.max(range.min, overrides.count)));
        }
        if (overrides.colourCount !== undefined) {
          expect(plan.colours.length).toBe(Math.min(limit, Math.max(2, overrides.colourCount)));
        }
        const ground = BUILDER_COLOURS.find((colour) => colour.name === overrides.ground);
        if (ground !== undefined) expect(plan.colours[0]).toEqual(ground);
      }),
      { seed: SEED, numRuns: NUM_RUNS, verbose: 1 },
    );
  });
});
