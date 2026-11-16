// Point-in-shape test shared by the parser (palette rule 4.6) and the rasterizer (5.4).
// See design.md, "Rasterizer".
import type { Point } from "./types.js";

/** Squared distance from (x, y) to the segment a-b. */
function squaredDistanceToSegment(a: Point, b: Point, x: number, y: number): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lengthSquared = dx * dx + dy * dy;
  let t = lengthSquared === 0 ? 0 : ((x - a[0]) * dx + (y - a[1]) * dy) / lengthSquared;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  const px = a[0] + t * dx - x;
  const py = a[1] + t * dy - y;
  return px * px + py * py;
}

/**
 * True when (x, y) is inside the shape under the non-zero winding rule, with the winding number
 * summed over all of the shape's polygons, or lies within `tolerance` of any edge (5.4: a point on
 * an edge counts as inside). Each polygon is closed implicitly.
 */
export function shapeContains(
  polygons: readonly (readonly Point[])[],
  x: number,
  y: number,
  tolerance: number,
): boolean {
  const toleranceSquared = tolerance * tolerance;
  let winding = 0;
  for (const polygon of polygons) {
    const count = polygon.length;
    for (let index = 0; index < count; index += 1) {
      const a = polygon[index] as Point;
      const b = polygon[(index + 1) % count] as Point;
      if (squaredDistanceToSegment(a, b, x, y) <= toleranceSquared) return true;
      // Signed area test: > 0 when (x, y) is left of a->b.
      const side = (b[0] - a[0]) * (y - a[1]) - (x - a[0]) * (b[1] - a[1]);
      if (a[1] <= y) {
        if (b[1] > y && side > 0) winding += 1;
      } else if (b[1] <= y && side < 0) {
        winding -= 1;
      }
    }
  }
  return winding !== 0;
}

/** Edge tolerance for a viewBox: 1e-9 times its diagonal (design, Rasterizer). */
export function edgeTolerance(width: number, height: number): number {
  return 1e-9 * Math.hypot(width, height);
}
