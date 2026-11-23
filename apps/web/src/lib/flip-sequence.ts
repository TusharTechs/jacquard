// Auto-fix placing its binding points (studio-experience 11.3): the engine's flips appear one by
// one in the engine's own order over at most FLIP_MS. Display only; the flips are the engine's.

export const FLIP_MS = 1500;

/** Start time of each flip, in order: evenly spaced, the last one starting before `duration`. */
export function flipSchedule(count: number, duration: number = FLIP_MS): number[] {
  const flips = Math.max(0, Math.floor(count));
  if (flips === 0) return [];
  const span = Math.max(0, duration) * 0.9;
  return Array.from({ length: flips }, (_, index) => (flips === 1 ? 0 : (span * index) / (flips - 1)));
}

/** How many flips show after `elapsed` ms: the flips whose start time has come, all at the end. */
export function flipsShownAt(schedule: readonly number[], elapsed: number, duration: number = FLIP_MS): number {
  if (elapsed >= duration) return schedule.length;
  if (!(elapsed >= 0)) return 0;
  let shown = 0;
  while (shown < schedule.length && (schedule[shown] as number) <= elapsed) shown += 1;
  return shown;
}
