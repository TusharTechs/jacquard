// A naive float checker, used as an independent oracle for Property 18.
// See design.md, Property 18 and Float checker.
//
// Independence rule: this file imports TYPES ONLY from `src` (`import type`). It must not import
// `runs.ts`, `floats.ts` or any other engine code. It finds runs by tiling a line and scanning it
// from left to right, with no ring arithmetic on run starts: a ring line is tiled three times, a
// run is kept when it starts in the middle tile, and its start is mapped back by subtracting the
// tile length.

import type { LiftPlan, LoomProfile, Violation } from "../src/types.js";

interface ScannedRun {
  readonly start: number;
  readonly length: number;
  readonly state: boolean;
}

/** Maximal runs of equal states, found by one left-to-right scan. */
function scan(cells: readonly boolean[]): ScannedRun[] {
  const runs: ScannedRun[] = [];
  let index = 0;
  while (index < cells.length) {
    const state = cells[index] as boolean;
    let end = index;
    while (end + 1 < cells.length && cells[end + 1] === state) end += 1;
    runs.push({ start: index, length: end - index + 1, state });
    index = end + 1;
  }
  return runs;
}

function tile(unit: readonly boolean[]): boolean[] {
  return [...unit, ...unit, ...unit];
}

/** R4.1: warp runs are face when lifted, back when not; weft runs are back when lifted, face when not. */
function sideOf(
  direction: "warp" | "weft",
  lifted: boolean,
  wovenFaceDown: boolean,
): "face" | "back" {
  const upSide = direction === "warp" ? (lifted ? "face" : "back") : lifted ? "back" : "face";
  if (!wovenFaceDown) return upSide;
  return upSide === "face" ? "back" : "face";
}

/**
 * Violations of one line.
 *
 * `unit` is the line as the plan gives it. When `ring` is true the line is tiled three times and
 * only runs starting in the middle tile are kept. When `ring` is false it is scanned as it is.
 * A line whose scan is one run covering all of it never interlaces, and gives one unbound violation.
 */
function checkLine(
  unit: readonly boolean[],
  ring: boolean,
  direction: "warp" | "weft",
  lineIndex: number,
  limit: number,
  wovenFaceDown: boolean,
): Violation[] {
  const length = unit.length;
  const scanned = scan(ring ? tile(unit) : unit);

  const only = scanned[0];
  if (scanned.length === 1 && only !== undefined) {
    return [
      {
        kind: "unbound",
        direction,
        side: sideOf(direction, only.state, wovenFaceDown),
        line: lineIndex,
        length,
      },
    ];
  }

  const violations: Violation[] = [];
  for (const run of scanned) {
    if (ring && (run.start < length || run.start >= 2 * length)) continue; // not in the middle tile
    if (run.length <= limit) continue;
    const start = ring ? run.start - length : run.start;
    violations.push({
      kind: "float",
      direction,
      side: sideOf(direction, run.state, wovenFaceDown),
      pick: direction === "warp" ? start : lineIndex,
      end: direction === "warp" ? lineIndex : start,
      length: run.length,
    });
  }
  return violations;
}

function rank(violation: Violation): readonly number[] {
  const kind = violation.kind === "unbound" ? 0 : 1;
  const side = violation.side === "face" ? 0 : 1;
  const direction = violation.direction === "warp" ? 0 : 1;
  if (violation.kind === "float") {
    return [kind, side, direction, violation.pick, violation.end];
  }
  // An unbound warp line has row key 0 and column key `line`; an unbound weft line has row key
  // `line` and column key 0 (design, Violations and order).
  return violation.direction === "warp"
    ? [kind, side, direction, 0, violation.line]
    : [kind, side, direction, violation.line, 0];
}

function compare(a: Violation, b: Violation): number {
  const left = rank(a);
  const right = rank(b);
  for (let position = 0; position < left.length; position += 1) {
    const difference = (left[position] as number) - (right[position] as number);
    if (difference !== 0) return difference;
  }
  return 0;
}

/**
 * Float violations of a valid lift plan, in the order of 4.6. Reads only the first `designWidth`
 * hooks of each pick, and treats the picks as a ring always and the ends as a ring only when the
 * plan has `repeatAcross`.
 */
export function naiveCheckFloats(plan: LiftPlan, profile: LoomProfile): Violation[] {
  const width = plan.designWidth;
  const rows = plan.lifts.map((row) => row.slice(0, width));
  const violations: Violation[] = [];

  for (let end = 0; end < width; end += 1) {
    const column = rows.map((row) => row[end] as boolean);
    violations.push(
      ...checkLine(column, true, "warp", end, profile.maxWarpFloat, profile.wovenFaceDown),
    );
  }
  rows.forEach((row, pick) => {
    violations.push(
      ...checkLine(row, plan.repeatAcross, "weft", pick, profile.maxWeftFloat, profile.wovenFaceDown),
    );
  });

  return violations.sort(compare);
}
