// The motif arriving on the point paper (studio-experience 11.1): cells are placed in weaving
// order, pick 0 upward and end 0 rightward within a pick, over at most REVEAL_MS. Display only.

export const REVEAL_MS = 900;

/** Cell indices (pick * ends + end) in the order they are placed. */
export function revealOrder(ends: number, picks: number): Int32Array {
  const count = Math.max(0, Math.floor(ends)) * Math.max(0, Math.floor(picks));
  const order = new Int32Array(count);
  for (let index = 0; index < count; index += 1) order[index] = index;
  return order;
}

/** How many cells are placed after `elapsed` ms of a `duration` ms reveal: eased, whole numbers. */
export function revealedCount(elapsed: number, total: number, duration: number = REVEAL_MS): number {
  const cells = Math.max(0, Math.floor(total));
  if (!(elapsed > 0)) return 0;
  if (!(duration > 0) || elapsed >= duration) return cells;
  const x = elapsed / duration;
  // Ease out: quick at first, settling at the end.
  const eased = 1 - (1 - x) * (1 - x);
  return Math.min(cells, Math.floor(eased * cells));
}
