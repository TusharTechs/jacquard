// Feature: motif-input, Property 6: Raster matches an independent oracle
// For any motif made only of axis-aligned rects with integer coordinates in a viewBox whose size is
// a multiple of the repeat, each cell equals the oracle: the palette index of the last rect that
// contains the cell centre (closed intervals), or 0, with pick 0 taken from the bottom of the
// viewBox.
// Validates: Requirements 5.2, 5.3, 5.4
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { parseMotif, rasterizeMotif } from "../src/index.js";
import { expectedPalette, hexColourArb, serializeMotif } from "./arbitraries.js";
import type { MotifDoc } from "./arbitraries.js";

const SEED = 4806;
const NUM_RUNS = 100;

interface RectCase {
  readonly ends: number;
  readonly picks: number;
  readonly doc: MotifDoc;
  readonly rects: readonly { x: number; y: number; width: number; height: number }[];
}

const caseArb: fc.Arbitrary<RectCase> = fc
  .record({
    ends: fc.integer({ min: 1, max: 32 }),
    picks: fc.integer({ min: 1, max: 32 }),
    // Cell size in viewBox units. Even sizes put cell centres on integer coordinates, so rect
    // edges pass exactly through centres and the closed-interval rule is exercised.
    kx: fc.integer({ min: 1, max: 4 }),
    ky: fc.integer({ min: 1, max: 4 }),
    minX: fc.integer({ min: -20, max: 20 }),
    minY: fc.integer({ min: -20, max: 20 }),
  })
  .chain(({ ends, picks, kx, ky, minX, minY }) => {
    const width = ends * kx;
    const height = picks * ky;
    const rectArb = fc
      .record({
        x: fc.integer({ min: minX - 2, max: minX + width + 1 }),
        y: fc.integer({ min: minY - 2, max: minY + height + 1 }),
        width: fc.integer({ min: 0, max: width + 2 }),
        height: fc.integer({ min: 0, max: height + 2 }),
        fill: hexColourArb,
      });
    return fc.record({ rects: fc.array(rectArb, { minLength: 0, maxLength: 8 }), background: fc.option(hexColourArb, { nil: undefined }) }).map(({ rects, background }) => {
      const all = background === undefined ? rects : [{ x: minX, y: minY, width, height, fill: background }, ...rects];
      const doc: MotifDoc = {
        viewBox: [minX, minY, width, height],
        nodes: all.map((r) => ({ kind: "rect" as const, x: r.x, y: r.y, width: r.width, height: r.height, fill: r.fill, transform: undefined })),
        xmlDeclaration: false,
        title: undefined,
        comment: false,
        quote: '"',
      };
      return { ends, picks, doc, rects: all };
    });
  });

/** The oracle: last rect (closed intervals) containing the centre of (end, pick); pick 0 at the bottom. */
function oracle({ ends, picks, doc, rects }: RectCase): number[][] {
  const [minX, minY, width, height] = doc.viewBox;
  const kx = width / ends;
  const ky = height / picks;
  const { indices } = expectedPalette(doc);
  const design: number[][] = [];
  for (let pick = 0; pick < picks; pick += 1) {
    const row: number[] = [];
    // Row `pick` counted from the bottom edge of the viewBox (y grows downward in SVG).
    const y = minY + height - (pick + 0.5) * ky;
    for (let end = 0; end < ends; end += 1) {
      const x = minX + (end + 0.5) * kx;
      let value = 0;
      rects.forEach((r, i) => {
        if (x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height) value = indices[i]!;
      });
      row.push(value);
    }
    design.push(row);
  }
  return design;
}

describe("Feature: motif-input, Property 6: Raster matches an independent oracle", () => {
  it("each cell is the last rect containing its centre (closed), pick 0 at the bottom", () => {
    fc.assert(
      fc.property(caseArb, (c) => {
        const parsed = parseMotif(serializeMotif(c.doc), 16);
        expect(parsed.ok).toBe(true);
        if (!parsed.ok) return;
        expect(rasterizeMotif(parsed.value, { ends: c.ends, picks: c.picks })).toEqual(oracle(c));
      }),
      { seed: SEED, numRuns: NUM_RUNS, verbose: 1 },
    );
  });
});
