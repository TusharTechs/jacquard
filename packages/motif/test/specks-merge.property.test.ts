// Feature: motif-input, Property 8: Speck merge choice
// For any design containing exactly one speck component that is smaller than Minimum_Feature,
// while all other components are at least Minimum_Feature, removeSpecks relabels exactly that
// component, to the neighbouring region with the most shared edges, lowest index on a tie. And for
// any design up to 12 by 12 with up to 5 regions and any Minimum_Feature from 1 to 12, removeSpecks
// equals a literal, relabel-everything-each-step implementation of 6.3 kept in `test/`.
// Validates: Requirements 6.3
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { removeSpecks } from "../src/index.js";
import { designArb, designOf } from "./arbitraries.js";
import { componentsOf, copyGrid, mergeTarget, sharedEdges } from "./grid.js";
import type { TestComponent } from "./grid.js";
import { removeSpecksLiterally } from "./specks-oracle.js";

const SEED = 4808;
const NUM_RUNS = 100;

interface SingleSpeckCase {
  readonly design: number[][];
  readonly speck: TestComponent;
  readonly minFeature: number;
}

/**
 * Blocky designs (tiles of 3 or 4 cells, so components are large) with a small planted blob, then
 * Minimum_Feature chosen between the smallest component size (exclusive) and the next size
 * (inclusive). Cases where the smallest component is not unique are discarded.
 */
const singleSpeckArb: fc.Arbitrary<SingleSpeckCase | undefined> = fc
  .record({
    scale: fc.integer({ min: 3, max: 4 }),
    tilesP: fc.integer({ min: 1, max: 6 }),
    tilesE: fc.integer({ min: 1, max: 6 }),
    regions: fc.integer({ min: 2, max: 6 }),
  })
  .chain(({ scale, tilesP, tilesE, regions }) =>
    fc.record({
      tiles: designOf(tilesP, tilesE, regions),
      seed: fc.nat(),
      walk: fc.array(fc.nat({ max: 3 }), { maxLength: 4 }),
      speckRegion: fc.integer({ min: 0, max: regions - 1 }),
      pickFrac: fc.nat(),
      scale: fc.constant(scale),
    }),
  )
  .map(({ tiles, seed, walk, speckRegion, pickFrac, scale }) => {
    const picks = tiles.length * scale;
    const ends = tiles[0]!.length * scale;
    const design = Array.from({ length: picks }, (_, p) => Array.from({ length: ends }, (_, e) => tiles[Math.floor(p / scale)]![Math.floor(e / scale)]!));
    let p = Math.floor((seed % (picks * ends)) / ends);
    let e = seed % ends;
    design[p]![e] = speckRegion;
    for (const step of walk) {
      if (step === 0) p = Math.max(0, p - 1);
      else if (step === 1) p = Math.min(picks - 1, p + 1);
      else if (step === 2) e = Math.max(0, e - 1);
      else e = Math.min(ends - 1, e + 1);
      design[p]![e] = speckRegion;
    }
    const components = componentsOf(design);
    if (components.length < 2) return undefined;
    const sizes = components.map((c) => c.cells.length).sort((a, b) => a - b);
    const smallest = sizes[0]!;
    const next = sizes[1]!;
    if (next === smallest) return undefined;
    const minFeature = smallest + 1 + (pickFrac % (next - smallest));
    const speck = components.find((c) => c.cells.length === smallest)!;
    return { design, speck, minFeature };
  });

describe("Feature: motif-input, Property 8: Speck merge choice", () => {
  it("relabels the only speck to the neighbour with the most shared edges, lowest index on a tie", () => {
    fc.assert(
      fc.property(singleSpeckArb, (c) => {
        fc.pre(c !== undefined);
        if (c === undefined) return;
        const { design, speck, minFeature } = c;
        // The case really has one speck and only one.
        expect(componentsOf(design).filter((x) => x.cells.length < minFeature)).toHaveLength(1);
        const target = mergeTarget(sharedEdges(design, speck));
        expect(target).toBeDefined();
        const expected = copyGrid(design);
        for (const [pick, end] of speck.cells) expected[pick]![end] = target!;
        expect(removeSpecks(design, minFeature)).toEqual(expected);
      }),
      { seed: SEED, numRuns: NUM_RUNS, verbose: 1 },
    );
  });

  it("equals the literal relabel-everything-each-step implementation of 6.3", () => {
    fc.assert(
      fc.property(designArb(12, 5), fc.integer({ min: 1, max: 12 }), (design, minFeature) => {
        expect(removeSpecks(design, minFeature)).toEqual(removeSpecksLiterally(design, minFeature));
      }),
      { seed: SEED, numRuns: NUM_RUNS, verbose: 1 },
    );
  });
});
