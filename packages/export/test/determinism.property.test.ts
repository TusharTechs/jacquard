// Feature: simulate-and-export, Property 10: Determinism and purity
// For any valid inputs, two calls of each of clothModel, writeWif, cardSheetSvg, cardSheetPdf and
// pointPaperSvg give byte-identical (or deeply equal) results, and the inputs are deeply equal to
// copies taken before the call.
// Validates: Requirements 1.5, 3.4, 4.7, 5.3
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { cardSheetPdf, cardSheetSvg, clothModel, pointPaperSvg, writeWif } from "../src/index.js";
import { planCaseArb, pointPaperCaseArb, sideArb, titleArb, yarnsArb } from "./arbitraries.js";

const SEED = 5110;
const NUM_RUNS = 100;

describe("Feature: simulate-and-export, Property 10: Determinism and purity", () => {
  it("gives identical output on repeated calls and leaves the inputs unchanged", () => {
    fc.assert(
      fc.property(
        planCaseArb,
        yarnsArb,
        sideArb,
        pointPaperCaseArb,
        fc.option(titleArb, { nil: undefined }),
        ({ plan, profile, design }, yarns, side, paper, title) => {
          const options = title === undefined ? {} : { title };
          const before = structuredClone({ plan, profile, design, yarns, paper, options });

          const cloth = [clothModel(plan, profile, yarns, side), clothModel(plan, profile, yarns, side)];
          expect(cloth[0]!.ok).toBe(true);
          expect(cloth[1]).toEqual(cloth[0]);

          const wif = [writeWif(plan, profile, yarns, options), writeWif(plan, profile, yarns, options)];
          expect(wif[0]!.ok).toBe(true);
          expect(wif[1]).toStrictEqual(wif[0]);

          const svg = [cardSheetSvg(plan, profile, options), cardSheetSvg(plan, profile, options)];
          expect(svg[0]!.ok).toBe(true);
          expect(svg[1]).toStrictEqual(svg[0]);

          const pdf = [cardSheetPdf(plan, profile, options), cardSheetPdf(plan, profile, options)];
          expect(pdf[0]!.ok && pdf[1]!.ok).toBe(true);
          if (pdf[0]!.ok && pdf[1]!.ok) {
            const a = pdf[0]!.value;
            const b = pdf[1]!.value;
            expect(b.length).toBe(a.length);
            expect(Buffer.from(b).equals(Buffer.from(a))).toBe(true);
          }

          const paperSvg = [
            pointPaperSvg(paper.design, paper.palette, options),
            pointPaperSvg(paper.design, paper.palette, options),
            // The engine design that the plan came from is a valid point-paper input too.
            pointPaperSvg(design, ["#f3ead8", "#8c2f39", "#1b1a17", "#3d6b4f"], options),
            pointPaperSvg(design, ["#f3ead8", "#8c2f39", "#1b1a17", "#3d6b4f"], options),
          ];
          expect(paperSvg[0]!.ok && paperSvg[2]!.ok).toBe(true);
          expect(paperSvg[1]).toStrictEqual(paperSvg[0]);
          expect(paperSvg[3]).toStrictEqual(paperSvg[2]);

          expect({ plan, profile, design, yarns, paper, options }).toEqual(before);
        },
      ),
      { seed: SEED, numRuns: NUM_RUNS, verbose: 1 },
    );
  });
});
