// Grid helpers for the editor: a blank design and a resize that keeps the overlapping cells.
// These only copy region numbers; they hold no weaving logic.
import type { Design } from "@jacquard/engine";

export interface GridSize {
  readonly ends: number;
  readonly picks: number;
}

/** A design of `picks` rows of `ends` cells, all region 0. */
export function blankDesign(size: GridSize): number[][] {
  return Array.from({ length: size.picks }, () => new Array<number>(size.ends).fill(0));
}

/** The size of a design: its pick count and the length of pick 0. */
export function sizeOf(design: Design): GridSize {
  return { ends: design[0]?.length ?? 0, picks: design.length };
}

/**
 * The design at a new size, anchored at end 0 and pick 0 (bottom left of the point paper). Cells in
 * both sizes keep their region; new cells are region 0.
 */
export function resizeDesign(design: Design, size: GridSize): number[][] {
  return Array.from({ length: size.picks }, (_, pick) =>
    Array.from({ length: size.ends }, (_, end) => design[pick]?.[end] ?? 0),
  );
}
