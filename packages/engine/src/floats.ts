// Float checker (Requirement 4). See design.md, "Float checker".
//
// Only the analysed unit is read: picks 0..pickCount-1 by ends 0..designWidth-1. Idle hooks are
// never read. With repeatAcross the other tiles are copies of the unit (validatePlan guarantees it).

import type { EngineResult } from "./errors.js";
import { validatePlan } from "./lift-plan.js";
import { err, ok } from "./result.js";
import { extractRuns } from "./runs.js";
import type { Direction, LiftPlan, LoomProfile, Side, Violation } from "./types.js";

/** Side of a run (4.1): warp-lifted and weft-unlifted are face, the rest back. wovenFaceDown swaps. */
export function sideOf(direction: Direction, state: boolean, wovenFaceDown: boolean): Side {
  const face = direction === "warp" ? state : !state;
  return face !== wovenFaceDown ? "face" : "back";
}

const KIND_RANK = { unbound: 0, float: 1 } as const;
const SIDE_RANK = { face: 0, back: 1 } as const;
const DIRECTION_RANK = { warp: 0, weft: 1 } as const;

function rowKey(violation: Violation): number {
  if (violation.kind === "float") return violation.pick;
  return violation.direction === "warp" ? 0 : violation.line;
}

function columnKey(violation: Violation): number {
  if (violation.kind === "float") return violation.end;
  return violation.direction === "warp" ? violation.line : 0;
}

/** Order from 4.6: kind, side, direction, row key, column key. */
export function compareViolations(a: Violation, b: Violation): number {
  return (
    KIND_RANK[a.kind] - KIND_RANK[b.kind] ||
    SIDE_RANK[a.side] - SIDE_RANK[b.side] ||
    DIRECTION_RANK[a.direction] - DIRECTION_RANK[b.direction] ||
    rowKey(a) - rowKey(b) ||
    columnKey(a) - columnKey(b)
  );
}

function analyseLine(
  cells: readonly boolean[],
  direction: Direction,
  index: number,
  ring: boolean,
  limit: number,
  wovenFaceDown: boolean,
  out: Violation[],
): void {
  const runs = extractRuns(cells, ring);
  if (runs.kind === "constant") {
    out.push({
      kind: "unbound",
      direction,
      side: sideOf(direction, runs.state, wovenFaceDown),
      line: index,
      length: runs.length,
    });
    return;
  }
  for (const run of runs.runs) {
    if (run.length <= limit) continue;
    out.push({
      kind: "float",
      direction,
      side: sideOf(direction, run.state, wovenFaceDown),
      pick: direction === "warp" ? run.start : index,
      end: direction === "warp" ? index : run.start,
      length: run.length,
    });
  }
}

/**
 * Finds floats and unbound lines in the analysed unit (4.1 to 4.6). Runs `validatePlan` first and
 * returns its error. Warp lines are always rings (4.2); weft lines are rings only with
 * `repeatAcross`. A constant line is reported once as `unbound`, never also as a float (4.4).
 * The inputs are not modified.
 */
export function checkFloats(plan: LiftPlan, profile: LoomProfile): EngineResult<Violation[]> {
  const validated = validatePlan(plan, profile);
  if (!validated.ok) return err(validated.error);

  const { pickCount, designWidth, repeatAcross, lifts } = plan;
  const violations: Violation[] = [];

  for (let end = 0; end < designWidth; end += 1) {
    const cells: boolean[] = [];
    for (let pick = 0; pick < pickCount; pick += 1) {
      cells.push((lifts[pick] as readonly boolean[])[end] as boolean);
    }
    analyseLine(cells, "warp", end, true, profile.maxWarpFloat, profile.wovenFaceDown, violations);
  }

  for (let pick = 0; pick < pickCount; pick += 1) {
    const cells = (lifts[pick] as readonly boolean[]).slice(0, designWidth);
    analyseLine(cells, "weft", pick, repeatAcross, profile.maxWeftFloat, profile.wovenFaceDown, violations);
  }

  violations.sort(compareViolations);
  return ok(violations);
}
