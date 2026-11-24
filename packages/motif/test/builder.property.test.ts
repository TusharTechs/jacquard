// Feature: motif-builder, Property 2: Builder output
// For any plan from Property 1's generators, buildMotif returns the same text twice; the text uses
// only svg, title, rect and polygon elements and numbers with at most 2 decimals; parseMotif with the
// plan's colour count accepts it with a palette equal to the plan's colours as a set and of the same
// length; and motifToDesign on repeats of 48 to 96 ends and picks with minimum feature 2 gives a
// design that uses every palette index.
// Validates: Requirements 2.1, 2.2, 2.3, 2.6
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { buildMotif, describeMotif, motifToDesign, parseMotif } from "../src/index.js";
import { descriptionArb, optionsArb } from "./builder-arbitraries.js";

const SEED = 6102;
const NUM_RUNS = 100;

describe("Feature: motif-builder, Property 2: Builder output", () => {
  it("is deterministic, valid Motif_SVG with the plan's palette, and keeps every colour in the design", () => {
    fc.assert(
      fc.property(
        descriptionArb,
        optionsArb,
        fc.integer({ min: 48, max: 96 }),
        fc.integer({ min: 48, max: 96 }),
        (text, options, ends, picks) => {
          const { plan } = describeMotif(text, options);
          const svg = buildMotif(plan);
          expect(buildMotif(structuredClone(plan))).toBe(svg);

          const elements = new Set([...svg.matchAll(/<([a-z]+)/g)].map((match) => match[1]));
          for (const name of elements) expect(["svg", "title", "rect", "polygon"]).toContain(name);
          for (const match of svg.matchAll(/points="([^"]*)"/g)) {
            for (const value of match[1]!.split(/[ ,]/)) expect(value).toMatch(/^-?\d+(\.\d{1,2})?$/);
          }

          const k = plan.colours.length;
          const parsed = parseMotif(svg, k);
          expect(parsed.ok, parsed.ok ? "" : JSON.stringify(parsed.error)).toBe(true);
          if (!parsed.ok) return;
          expect(parsed.value.palette).toHaveLength(k);
          expect(new Set(parsed.value.palette)).toEqual(new Set(plan.colours.map((colour) => colour.hex)));
          expect(parsed.value.palette[0]).toBe(plan.colours[0]!.hex);

          const result = motifToDesign(svg, { colourCount: k, symmetry: plan.symmetry, repeat: { ends, picks }, minFeature: 2 });
          expect(result.ok).toBe(true);
          if (!result.ok) return;
          const used = new Set(result.value.design.flat());
          for (let index = 0; index < k; index += 1) {
            expect(used.has(index), `palette index ${index} (${result.value.palette[index]}) missing for ${JSON.stringify(plan)} at ${ends}x${picks}`).toBe(true);
          }
        },
      ),
      { seed: SEED, numRuns: NUM_RUNS, verbose: 1 },
    );
  });
});
