// Mirror symmetry on the design grid (Requirement 7). See design.md, "Symmetry".
//
// `mirrorEnds` copies the left half, including the middle end when the width is odd, onto the
// right half (7.1). `mirrorPicks` copies the low picks, including the middle pick, onto the high
// picks (7.2). `mirrorBoth` is `mirrorEnds` then `mirrorPicks` (7.3). Pure: returns new arrays.
import type { Symmetry } from "./types.js";

type Grid = readonly (readonly number[])[];

function mirrorEnds(design: Grid): number[][] {
  return design.map((cells) => {
    const ends = cells.length;
    const half = Math.ceil(ends / 2);
    return cells.map((cell, end) => (end < half ? cell : (cells[ends - 1 - end] as number)));
  });
}

function mirrorPicks(design: Grid): number[][] {
  const picks = design.length;
  const half = Math.ceil(picks / 2);
  return design.map((cells, pick) => [...(pick < half ? cells : (design[picks - 1 - pick] as readonly number[]))]);
}

/** Returns a new design that is symmetric for `symmetry`; `none` returns an equal copy (7.4). */
export function applySymmetry(design: Grid, symmetry: Symmetry): number[][] {
  switch (symmetry) {
    case "none":
      return design.map((cells) => [...cells]);
    case "mirrorEnds":
      return mirrorEnds(design);
    case "mirrorPicks":
      return mirrorPicks(design);
    case "mirrorBoth":
      return mirrorPicks(mirrorEnds(design));
  }
}
