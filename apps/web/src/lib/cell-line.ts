// The cells on a straight line between two cells (Bresenham), both ends included, so a fast drag
// that skips cells between two pointer events still paints every cell it passed over (9.2).
export interface GridCell {
  readonly end: number;
  readonly pick: number;
}

export function cellLine(from: GridCell, to: GridCell): GridCell[] {
  const cells: GridCell[] = [];
  let end = from.end;
  let pick = from.pick;
  const dEnd = Math.abs(to.end - from.end);
  const dPick = -Math.abs(to.pick - from.pick);
  const stepEnd = from.end < to.end ? 1 : -1;
  const stepPick = from.pick < to.pick ? 1 : -1;
  let error = dEnd + dPick;
  // Bounded by the line length, so a bad input can never loop forever.
  for (let guard = 0; guard <= dEnd - dPick + 1; guard += 1) {
    cells.push({ end, pick });
    if (end === to.end && pick === to.pick) break;
    const doubled = 2 * error;
    if (doubled >= dPick) {
      error += dPick;
      end += stepEnd;
    }
    if (doubled <= dEnd) {
      error += dEnd;
      pick += stepPick;
    }
  }
  return cells;
}
