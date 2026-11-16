// Motif to design grid (Requirement 5). See design.md, "Rasterizer".
//
// Each cell (end, pick) is sampled at its centre. End 0 is the left edge of the viewBox and pick 0
// the bottom edge, because point paper draws pick 0 at the bottom (5.3). The last shape in document
// order that contains the centre wins (5.2); containment is non-zero winding with on-edge points
// counted as inside (5.4).
import { edgeTolerance, shapeContains } from "./geometry.js";
import type { Motif, Point, Repeat } from "./types.js";

interface Bounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

/** Bounding box of a shape, grown by the edge tolerance; used only to skip shapes quickly. */
function boundsOf(polygons: readonly (readonly Point[])[], tolerance: number): Bounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const polygon of polygons) {
    for (const [x, y] of polygon) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return { minX: minX - tolerance, minY: minY - tolerance, maxX: maxX + tolerance, maxY: maxY + tolerance };
}

/**
 * Returns `design[pick][end]` of exactly `repeat.picks` rows of `repeat.ends` cells (5.1), with
 * values from 0 to palette length minus 1 (5.5).
 */
export function rasterizeMotif(motif: Motif, repeat: Repeat): number[][] {
  const [minX, minY, width, height] = motif.viewBox;
  const tolerance = edgeTolerance(width, height);
  const shapes = motif.shapes.map((shape) => ({
    paletteIndex: shape.paletteIndex,
    polygons: shape.polygons,
    bounds: boundsOf(shape.polygons, tolerance),
  }));
  const design: number[][] = [];
  for (let pick = 0; pick < repeat.picks; pick += 1) {
    const y = minY + height - ((pick + 0.5) * height) / repeat.picks;
    // Shapes whose bounds cross this pick's centre line, last first.
    const candidates = shapes.filter((shape) => shape.bounds.minY <= y && y <= shape.bounds.maxY).reverse();
    const cells: number[] = [];
    for (let end = 0; end < repeat.ends; end += 1) {
      const x = minX + ((end + 0.5) * width) / repeat.ends;
      let region = 0;
      for (const shape of candidates) {
        if (x < shape.bounds.minX || x > shape.bounds.maxX) continue;
        if (shapeContains(shape.polygons, x, y, tolerance)) {
          region = shape.paletteIndex;
          break;
        }
      }
      cells.push(region);
    }
    design.push(cells);
  }
  return design;
}
