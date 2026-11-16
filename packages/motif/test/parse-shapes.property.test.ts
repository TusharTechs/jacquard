// Feature: motif-input, Property 3: Parse matches the drawn shapes
// For any generated list of shapes (rect, circle, ellipse, polygon, path; with and without `g`
// groups, inherited fills and translate/scale transforms) serialised to Motif_SVG, parseMotif
// returns the same viewBox, a palette equal to the expected palette from the 4.6 rule, one shape
// per drawn shape with a non-`none` fill in document order with the expected palette index, and
// rect polygons equal to the transformed corners. When the expected palette is longer than the
// limit, the result is MOTIF_TOO_MANY_COLOURS with that count and limit.
// Validates: Requirements 4.5, 4.6, 4.7
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { parseMotif } from "../src/index.js";
import type { Point } from "../src/index.js";
import { expectedPalette, expectedShapes, motifDocArb, serializeMotif } from "./arbitraries.js";

const SEED = 4803;
const NUM_RUNS = 100;

const EPSILON = 1e-9;

function close(a: number, b: number): boolean {
  return Math.abs(a - b) <= EPSILON * Math.max(1, Math.abs(a), Math.abs(b));
}

function samePoints(actual: readonly Point[], expected: readonly (readonly [number, number])[]): boolean {
  return actual.length === expected.length && actual.every((p, i) => close(p[0], expected[i]![0]) && close(p[1], expected[i]![1]));
}

describe("Feature: motif-input, Property 3: Parse matches the drawn shapes", () => {
  it("returns the drawn viewBox, palette, shapes and geometry, or MOTIF_TOO_MANY_COLOURS", () => {
    fc.assert(
      fc.property(motifDocArb, fc.integer({ min: 1, max: 8 }), (doc, limit) => {
        const svg = serializeMotif(doc);
        const result = parseMotif(svg, limit);
        const { palette, indices } = expectedPalette(doc);
        if (palette.length > limit) {
          expect(result, svg).toEqual({
            ok: false,
            error: expect.objectContaining({ code: "MOTIF_TOO_MANY_COLOURS", count: palette.length, limit }),
          });
          return;
        }
        expect(result.ok, svg).toBe(true);
        if (!result.ok) return;
        const motif = result.value;
        expect(motif.viewBox).toEqual(doc.viewBox);
        expect(motif.palette).toEqual(palette);
        const shapes = expectedShapes(doc);
        expect(motif.shapes.map((s) => s.paletteIndex)).toEqual(indices);
        shapes.forEach((shape, i) => {
          const actual = motif.shapes[i]!;
          const geometry = shape.geometry;
          if (geometry.kind === "rect") {
            expect(actual.polygons.length, `shape ${i}`).toBe(1);
            expect(samePoints(actual.polygons[0]!, geometry.corners), `rect ${i}: ${JSON.stringify(actual.polygons)} vs ${JSON.stringify(geometry.corners)}`).toBe(true);
          } else if (geometry.kind === "polygon") {
            expect(actual.polygons.length, `shape ${i}`).toBe(geometry.polygons.length);
            geometry.polygons.forEach((poly, j) => {
              expect(samePoints(actual.polygons[j]!, poly), `shape ${i} polygon ${j}: ${JSON.stringify(actual.polygons[j])} vs ${JSON.stringify(poly)}`).toBe(true);
            });
          } else {
            // Circles and ellipses: one fixed 64-gon (design, Parser) whose vertices lie on the transformed ellipse.
            expect(actual.polygons.length, `shape ${i}`).toBe(1);
            const ring = actual.polygons[0]!;
            expect(ring.length).toBe(64);
            for (const [x, y] of ring) {
              const u = (x - geometry.centre[0]) / geometry.rx;
              const v = (y - geometry.centre[1]) / geometry.ry;
              expect(Math.abs(u * u + v * v - 1), `ellipse ${i} vertex (${x}, ${y})`).toBeLessThan(1e-9);
            }
          }
        });
      }),
      { seed: SEED, numRuns: NUM_RUNS, verbose: 1 },
    );
  });
});
