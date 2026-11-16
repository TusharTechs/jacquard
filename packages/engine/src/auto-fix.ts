// Auto-fix (Requirement 5). See design.md, "Auto-fix".
//
// This part holds the badness measure and the incremental run tables. The unit is a private copy of
// the analysed cells (picks 0..pickCount-1 by ends 0..designWidth-1); idle hooks are never read and
// the input plan is never written.

import { autofixFailed, type EngineResult } from "./errors.js";
import { compareViolations, sideOf } from "./floats.js";
import { validatePlan } from "./lift-plan.js";
import { err, ok } from "./result.js";
import { extractRuns, type LineRuns } from "./runs.js";
import type { AutoFixOutput, Direction, Flip, LiftPlan, LoomProfile, Violation } from "./types.js";

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

// ---------------------------------------------------------------------------------------------
// Safe flips and cell ranking (5.4, 5.7). See design.md, "Candidates and safe flips" and
// "Choosing a cell".
// ---------------------------------------------------------------------------------------------

export type LineDirection = "warp" | "weft";

/**
 * A violation seen by auto-fix: a float run of `length` cells starting at ring index `start` of
 * warp line `line` (an end) or weft line `line` (a pick), or a whole unbound line (`unbound`,
 * `start` 0, `length` the line length).
 */
export interface FixTarget {
  readonly direction: LineDirection;
  readonly line: number;
  readonly start: number;
  readonly length: number;
  readonly unbound: boolean;
}

/** One cell of a target run, with its offset from the run start in ring order. */
export interface Candidate {
  readonly end: number;
  readonly pick: number;
  readonly offset: number;
}

/** The satin lattice `(pick - step * end) mod size = 0` used to place flips (5.7). */
export interface Lattice {
  readonly size: number;
  readonly step: number;
}

function gcd(a: number, b: number): number {
  let x = a;
  let y = b;
  while (y !== 0) [x, y] = [y, x % y];
  return x;
}

/**
 * Lattice for float limit `limit`: `size` is the largest integer `<= limit + 1` that has a step `s`
 * in `[2, size - 2]` coprime with it, and `step` is the smallest such `s`. When `limit + 1 < 5`
 * the lattice is `size = limit + 1`, `step = 1`. For limit 8 this is size 9, step 2.
 */
export function latticeFor(limit: number): Lattice {
  if (limit + 1 < 5) return { size: Math.max(1, limit + 1), step: 1 };
  for (let size = limit + 1; size >= 5; size -= 1) {
    for (let step = 2; step <= size - 2; step += 1) {
      if (gcd(size, step) === 1) return { size, step };
    }
  }
  // Unreachable: size 5 always has step 2.
  return { size: 5, step: 2 };
}

/** True when cell (`end`, `pick`) lies on `lattice`, using a non-negative modulo. */
export function onLattice(lattice: Lattice, end: number, pick: number): boolean {
  const value = (pick - lattice.step * end) % lattice.size;
  return (value + lattice.size) % lattice.size === 0;
}

function limitOf(unit: WorkUnit, direction: LineDirection): number {
  return direction === "warp" ? unit.maxWarpFloat : unit.maxWeftFloat;
}

function lineLength(unit: WorkUnit, direction: LineDirection): number {
  return direction === "warp" ? unit.pickCount : unit.designWidth;
}

function isRing(unit: WorkUnit, direction: LineDirection): boolean {
  return direction === "warp" ? true : unit.repeatAcross;
}

/**
 * True when flipping the cell at `index` of a line (cells `line`, a ring or not) would leave the
 * line non-constant with the run through `index` no longer than `limit`.
 */
function lineStaysLegal(line: readonly boolean[], index: number, ring: boolean, limit: number): boolean {
  const length = line.length;
  const target = !(line[index] as boolean);
  // Non-constant after the flip: some other cell must differ from the new state.
  let different = false;
  for (let other = 0; other < length; other += 1) {
    if (other !== index && line[other] !== target) {
      different = true;
      break;
    }
  }
  if (!different) return false;
  // Run through the flipped cell: count equal neighbours each way, bounded by limit + 1.
  let count = 1;
  for (const step of [1, -1]) {
    for (let distance = 1; distance < length && count <= limit; distance += 1) {
      let at = index + step * distance;
      if (ring) at = ((at % length) + length) % length;
      else if (at < 0 || at >= length) break;
      if (line[at] !== target) break;
      count += 1;
    }
  }
  return count <= limit;
}

/**
 * Safe flip (design, Candidates and safe flips): flipping the cell at (`end`, `pick`) is safe when,
 * in both lines through it, the run containing the cell (now merged with its new-state neighbours)
 * is within that line's limit, and neither line is constant afterwards.
 */
export function isSafeFlip(unit: WorkUnit, end: number, pick: number): boolean {
  const warpLine: boolean[] = [];
  for (let at = 0; at < unit.pickCount; at += 1) {
    warpLine.push((unit.cells[at] as boolean[])[end] as boolean);
  }
  const weftLine = unit.cells[pick] as boolean[];
  return (
    lineStaysLegal(warpLine, pick, true, unit.maxWarpFloat) &&
    lineStaysLegal(weftLine, end, unit.repeatAcross, unit.maxWeftFloat)
  );
}

/** Every cell of the target run or unbound line, in ring order from the run start. */
export function candidatesOf(unit: WorkUnit, target: FixTarget): Candidate[] {
  const length = lineLength(unit, target.direction);
  const candidates: Candidate[] = [];
  for (let offset = 0; offset < target.length; offset += 1) {
    const index = (target.start + offset) % length;
    candidates.push(
      target.direction === "warp"
        ? { end: target.line, pick: index, offset }
        : { end: index, pick: target.line, offset },
    );
  }
  return candidates;
}

/**
 * Longest piece of the target left after flipping the candidate at `offset`: the two pieces of a
 * float run, or for an unbound line one piece of `length - 1` on a ring and two pieces otherwise.
 */
export function longestRemainingPiece(unit: WorkUnit, target: FixTarget, offset: number): number {
  if (target.unbound && isRing(unit, target.direction)) return target.length - 1;
  return Math.max(offset, target.length - 1 - offset);
}

/**
 * Safe candidates of `target`, best first: on the lattice of the line being fixed, then smaller
 * longest remaining piece, then lower offset from the run start (5.7). Empty when none is safe.
 */
export function rankSafeCandidates(unit: WorkUnit, target: FixTarget): Candidate[] {
  return rankCandidates(unit, target, true);
}

/** All candidates of `target` in the 5.7 rank order, optionally keeping only safe ones. */
function rankCandidates(unit: WorkUnit, target: FixTarget, safeOnly: boolean): Candidate[] {
  const lattice = latticeFor(limitOf(unit, target.direction));
  return candidatesOf(unit, target)
    .filter((candidate) => !safeOnly || isSafeFlip(unit, candidate.end, candidate.pick))
    .map((candidate) => ({
      candidate,
      off: onLattice(lattice, candidate.end, candidate.pick) ? 0 : 1,
      piece: longestRemainingPiece(unit, target, candidate.offset),
    }))
    .sort((a, b) => a.off - b.off || a.piece - b.piece || a.candidate.offset - b.candidate.offset)
    .map((entry) => entry.candidate);
}

// ---------------------------------------------------------------------------------------------
// The loop (5.1, 5.2, 5.3, 5.5, 5.6, 5.8). See design.md, "Algorithm".
// ---------------------------------------------------------------------------------------------

export interface AutoFixOptions {
  /** Most flips allowed. Default `4 * pickCount * designWidth`. */
  readonly maxIterations?: number;
}

interface Found {
  readonly violation: Violation;
  readonly target: FixTarget;
}

function pushLine(
  unit: WorkUnit,
  profile: LoomProfile,
  direction: Direction,
  line: number,
  runs: LineRuns,
  out: Found[],
): void {
  const limit = direction === "warp" ? unit.maxWarpFloat : unit.maxWeftFloat;
  if (runs.kind === "constant") {
    out.push({
      violation: {
        kind: "unbound",
        direction,
        side: sideOf(direction, runs.state, profile.wovenFaceDown),
        line,
        length: runs.length,
      },
      target: { direction, line, start: 0, length: runs.length, unbound: true },
    });
    return;
  }
  for (const run of runs.runs) {
    if (run.length <= limit) continue;
    out.push({
      violation: {
        kind: "float",
        direction,
        side: sideOf(direction, run.state, profile.wovenFaceDown),
        pick: direction === "warp" ? run.start : line,
        end: direction === "warp" ? line : run.start,
        length: run.length,
      },
      target: { direction, line, start: run.start, length: run.length, unbound: false },
    });
  }
}

/** Violations of the unit in the 4.6 order, each with its fix target. */
function violationsOf(unit: WorkUnit, profile: LoomProfile): Found[] {
  const found: Found[] = [];
  for (let end = 0; end < unit.designWidth; end += 1) {
    pushLine(unit, profile, "warp", end, unit.warpRuns[end] as LineRuns, found);
  }
  for (let pick = 0; pick < unit.pickCount; pick += 1) {
    pushLine(unit, profile, "weft", pick, unit.weftRuns[pick] as LineRuns, found);
  }
  return found.sort((a, b) => compareViolations(a.violation, b.violation));
}

/** Writes the unit into a copy of the plan, tiling it across every tile with `repeatAcross` (5.6). */
function expandUnit(plan: LiftPlan, unit: WorkUnit): LiftPlan {
  const lifts: boolean[][] = [];
  for (let pick = 0; pick < plan.pickCount; pick += 1) {
    const row = (plan.lifts[pick] as readonly boolean[]).slice();
    const cells = unit.cells[pick] as boolean[];
    const limit = plan.repeatAcross ? plan.hookCount : plan.designWidth;
    for (let hook = 0; hook < limit; hook += 1) row[hook] = cells[hook % plan.designWidth] as boolean;
    lifts.push(row);
  }
  return {
    pickCount: plan.pickCount,
    hookCount: plan.hookCount,
    designWidth: plan.designWidth,
    repeatAcross: plan.repeatAcross,
    lifts,
  };
}

/**
 * Fixes floats and unbound lines by flipping lift-plan cells (Requirement 5). Runs `validatePlan`
 * first. A plan with no violations is returned unchanged with no flips. Otherwise each step takes
 * the best-ranked safe flip of the first violation that has one; when no violation has a safe flip,
 * the flip with the lowest negative change in badness; when there is none, it fails with `stuck`.
 * Failure returns `AUTOFIX_FAILED` with the violations left and no plan (5.8). Only the analysed
 * unit is edited, then copied to every tile with `repeatAcross`; idle hooks are never touched. The
 * inputs are not modified.
 */
export function autoFix(
  plan: LiftPlan,
  profile: LoomProfile,
  options: AutoFixOptions = {},
): EngineResult<AutoFixOutput> {
  const validated = validatePlan(plan, profile);
  if (!validated.ok) return err(validated.error);

  const maxIterations = options.maxIterations ?? 4 * plan.pickCount * plan.designWidth;
  const unit = createWorkUnit(plan, profile);
  const flips: Flip[] = [];

  for (;;) {
    const found = violationsOf(unit, profile);
    if (found.length === 0) {
      return ok({ plan: flips.length === 0 ? plan : expandUnit(plan, unit), flips });
    }
    const remaining = (): Violation[] => found.map((entry) => entry.violation);
    if (flips.length >= maxIterations) {
      return err(autofixFailed("iterationLimit", maxIterations, remaining()));
    }

    // Safe phase: first violation in order that has a safe candidate.
    let chosen: Candidate | undefined;
    for (const entry of found) {
      chosen = rankSafeCandidates(unit, entry.target)[0];
      if (chosen !== undefined) break;
    }

    // Fallback: lowest change in badness over every candidate; ties keep the earlier violation, then rank.
    if (chosen === undefined) {
      let best = 0;
      for (const entry of found) {
        for (const candidate of rankCandidates(unit, entry.target, false)) {
          const delta = flipCell(unit, candidate.end, candidate.pick);
          flipCell(unit, candidate.end, candidate.pick);
          if (delta < best) {
            best = delta;
            chosen = candidate;
          }
        }
      }
      if (chosen === undefined) return err(autofixFailed("stuck", maxIterations, remaining()));
    }

    flipCell(unit, chosen.end, chosen.pick);
    flips.push({ pick: chosen.pick, end: chosen.end });
  }
}
