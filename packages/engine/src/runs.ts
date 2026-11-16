// Run extraction for the float checker (4.1 to 4.4). See design.md, "Float checker", Runs.
//
// A line is a list of lift states along one end (warp) or one pick (weft). A run is a maximal
// stretch of equal states. A line is a ring when its far end continues at its near end (4.2).

export interface Run {
  /** Index of the first cell of the run, in ring order for a ring line. */
  readonly start: number;
  readonly length: number;
  /** The lift state shared by every cell of the run. */
  readonly state: boolean;
}

export type LineRuns =
  /** Every cell has the same state. Such a line never interlaces: it is "unbound" (4.4). */
  | { readonly kind: "constant"; readonly state: boolean; readonly length: number }
  /** At least two runs, from the lowest start index upward. */
  | { readonly kind: "runs"; readonly runs: readonly Run[] };

/**
 * Splits a line into runs.
 *
 * - A constant line is one unbound run, whether or not it is a ring (4.4).
 * - A linear line gives maximal runs from index 0.
 * - A ring line that is not constant gives a run at every index `i` where `cells[i]` differs from
 *   `cells[(i - 1) mod L]`, listed from the lowest such `i`. The last run may wrap past the end.
 *   Where a run starts depends only on the ring, not on where index 0 is, so rotating the line
 *   moves every start by the same amount (Property 19).
 *
 * An empty line has no runs.
 */
export function extractRuns(cells: readonly boolean[], ring: boolean): LineRuns {
  const length = cells.length;
  const first = cells[0];
  if (first === undefined) return { kind: "runs", runs: [] };
  if (cells.every((cell) => cell === first)) return { kind: "constant", state: first, length };

  // Indices where a new run begins. A ring line also starts a run at index 0 when the last cell
  // differs from the first; a linear line always starts one at index 0.
  const starts: number[] = [];
  for (let index = 0; index < length; index += 1) {
    const previous = index === 0 ? (ring ? cells[length - 1] : undefined) : cells[index - 1];
    if (previous === undefined || previous !== cells[index]) starts.push(index);
  }

  const runs: Run[] = starts.map((start, position) => {
    const nextStart = starts[position + 1];
    const state = cells[start] as boolean;
    if (nextStart !== undefined) return { start, length: nextStart - start, state };
    // The last run ends at the end of the line (linear), or wraps to the first start (ring).
    const wrapsTo = ring ? (starts[0] as number) : 0;
    return { start, length: length - start + wrapsTo, state };
  });
  return { kind: "runs", runs };
}
