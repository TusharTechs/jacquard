// Auto-fix (Requirement 5). See design.md, "Auto-fix".
//
// This part holds the badness measure and the incremental run tables. The unit is a private copy of
// the analysed cells (picks 0..pickCount-1 by ends 0..designWidth-1); idle hooks are never read and
// the input plan is never written.

import { extractRuns, type LineRuns } from "./runs.js";
import type { LiftPlan, LoomProfile } from "./types.js";

/**
 * Badness of one line: for each float run `length - limit` when the run is longer than the limit;
 * for an unbound (constant) line `max(1, L - limit)` where `L` is the line length. An empty line
 * has badness 0.
 */
export function lineBadness(runs: LineRuns, limit: number): number {
  if (runs.kind === "constant") return Math.max(1, runs.length - limit);
  let total = 0;
  for (const run of runs.runs) {
    if (run.length > limit) total += run.length - limit;
  }
  return total;
}

/**
 * Mutable working state for auto-fix: a private copy of the unit's cells, the run table of every
 * warp line and weft line, the badness of every line, and their sum.
 */
export interface WorkUnit {
  readonly pickCount: number;
  readonly designWidth: number;
  readonly repeatAcross: boolean;
  readonly maxWarpFloat: number;
  readonly maxWeftFloat: number;
  /** `cells[pick][end]`, true = lifted. A private copy. */
  readonly cells: boolean[][];
  /** `warpRuns[end]`: runs of `cells[0..pickCount-1][end]`, always a ring. */
  readonly warpRuns: LineRuns[];
  /** `weftRuns[pick]`: runs of `cells[pick][0..designWidth-1]`, a ring only with `repeatAcross`. */
  readonly weftRuns: LineRuns[];
  readonly warpBadness: number[];
  readonly weftBadness: number[];
  /** Sum of every line's badness. Zero exactly when `checkFloats` reports no violations. */
  badness: number;
}

function warpCells(unit: WorkUnit, end: number): boolean[] {
  const cells: boolean[] = [];
  for (let pick = 0; pick < unit.pickCount; pick += 1) {
    cells.push((unit.cells[pick] as boolean[])[end] as boolean);
  }
  return cells;
}

function refreshWarp(unit: WorkUnit, end: number): void {
  const runs = extractRuns(warpCells(unit, end), true);
  const next = lineBadness(runs, unit.maxWarpFloat);
  unit.badness += next - (unit.warpBadness[end] as number);
  unit.warpRuns[end] = runs;
  unit.warpBadness[end] = next;
}

function refreshWeft(unit: WorkUnit, pick: number): void {
  const runs = extractRuns(unit.cells[pick] as boolean[], unit.repeatAcross);
  const next = lineBadness(runs, unit.maxWeftFloat);
  unit.badness += next - (unit.weftBadness[pick] as number);
  unit.weftRuns[pick] = runs;
  unit.weftBadness[pick] = next;
}

/**
 * Copies the analysed unit of an already validated plan and builds every run table. The plan is
 * not modified and the copy shares no arrays with it.
 */
export function createWorkUnit(plan: LiftPlan, profile: LoomProfile): WorkUnit {
  const { pickCount, designWidth, repeatAcross, lifts } = plan;
  const cells: boolean[][] = [];
  for (let pick = 0; pick < pickCount; pick += 1) {
    cells.push((lifts[pick] as readonly boolean[]).slice(0, designWidth));
  }
  const unit: WorkUnit = {
    pickCount,
    designWidth,
    repeatAcross,
    maxWarpFloat: profile.maxWarpFloat,
    maxWeftFloat: profile.maxWeftFloat,
    cells,
    warpRuns: new Array<LineRuns>(designWidth),
    weftRuns: new Array<LineRuns>(pickCount),
    warpBadness: new Array<number>(designWidth).fill(0),
    weftBadness: new Array<number>(pickCount).fill(0),
    badness: 0,
  };
  for (let end = 0; end < designWidth; end += 1) refreshWarp(unit, end);
  for (let pick = 0; pick < pickCount; pick += 1) refreshWeft(unit, pick);
  return unit;
}

/**
 * Flips the cell at (`end`, `pick`) and recomputes only warp line `end` and weft line `pick`, which
 * costs O(pickCount + designWidth). Returns the change in badness (negative when it improves).
 */
export function flipCell(unit: WorkUnit, end: number, pick: number): number {
  const before = unit.badness;
  const row = unit.cells[pick] as boolean[];
  row[end] = !(row[end] as boolean);
  refreshWarp(unit, end);
  refreshWeft(unit, pick);
  return unit.badness - before;
}
