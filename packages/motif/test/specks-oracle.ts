// Literal reference implementation of speck removal, Requirement 6.3, for Property 8.
//
// Slow on purpose: every step relabels the whole grid from scratch, then applies 6.3 word for word.
//   1. Label the 4-connected components.
//   2. If there is at most one component, stop (6.2).
//   3. Specks are components with fewer than `minFeature` cells. If there are none, stop.
//   4. Take the smallest speck; on a size tie, the one whose first cell in pick-major order
//      (`pick * ends + end`) is lowest.
//   5. Count, for each neighbouring region, the cell edges it shares with the speck. Relabel the
//      speck to the region with the most shared edges, the lowest region index on a tie.
//   6. Repeat.
// It shares no code with `src/specks.ts` (adapted from an earlier task's /tmp reference, rewritten
// on 2D coordinates with the helpers in `grid.ts`).
import { componentsOf, copyGrid, mergeTarget, sharedEdges } from "./grid.js";
import type { Grid } from "./grid.js";

export function removeSpecksLiterally(design: Grid, minFeature: number): number[][] {
  const grid = copyGrid(design);
  const ends = grid[0]?.length ?? 0;
  for (;;) {
    const components = componentsOf(grid);
    if (components.length <= 1) return grid;
    const specks = components.filter((component) => component.cells.length < minFeature);
    if (specks.length === 0) return grid;
    const firstCell = (cells: readonly (readonly [number, number])[]): number =>
      Math.min(...cells.map(([pick, end]) => pick * ends + end));
    specks.sort((a, b) => a.cells.length - b.cells.length || firstCell(a.cells) - firstCell(b.cells));
    const speck = specks[0]!;
    const target = mergeTarget(sharedEdges(grid, speck));
    if (target === undefined) throw new Error("oracle: a speck with no neighbour in a multi-component design");
    for (const [pick, end] of speck.cells) grid[pick]![end] = target;
  }
}
