// Where to draw the engine's violations and errors on the point paper. Display only: the
// violations themselves come from the engine's checkFloats, unchanged.
import type { EngineError, Flip, Violation } from "@jacquard/engine";

export type MarkKind = "start" | "run";

/** Cell key used by the point paper: `${pick},${end}`. */
export function cellKey(end: number, pick: number): string {
  return `${pick},${end}`;
}

/**
 * Marks for each violation: the start cell of a float gets "start" (outline plus triangle), the
 * other cells it passes over get "run" (outline). An unbound line is marked over its whole length,
 * with its first cell as the start. Runs wrap around the repeat, as the engine reports them.
 */
export function violationMarks(violations: readonly Violation[], ends: number, picks: number): Map<string, MarkKind> {
  const marks = new Map<string, MarkKind>();
  if (ends < 1 || picks < 1) return marks;
  const put = (end: number, pick: number, kind: MarkKind): void => {
    const key = cellKey(end, pick);
    if (kind === "start" || !marks.has(key)) marks.set(key, kind);
  };
  for (const violation of violations) {
    const warp = violation.direction === "warp";
    const startEnd = violation.kind === "float" ? violation.end : warp ? violation.line : 0;
    const startPick = violation.kind === "float" ? violation.pick : warp ? 0 : violation.line;
    const span = Math.min(violation.length, warp ? picks : ends);
    for (let step = 0; step < span; step += 1) {
      const end = warp ? startEnd : (startEnd + step) % ends;
      const pick = warp ? (startPick + step) % picks : startPick;
      put(end, pick, step === 0 ? "start" : "run");
    }
  }
  return marks;
}

/**
 * Point-paper cells under the engine's auto-fix flips. A flip names a lift-plan pick and hook;
 * with "repeat across" a hook past the repeat width shows on the design end it repeats, the same
 * wrap the violation marks use. Display only.
 */
export function flipCells(flips: readonly Flip[], ends: number, picks: number): Set<string> {
  const cells = new Set<string>();
  if (ends < 1 || picks < 1) return cells;
  for (const flip of flips) cells.add(cellKey(flip.end % ends, flip.pick % picks));
  return cells;
}

/** Violation start cells in pick-major order: the targets of the "next violation" key. */
export function violationStarts(marks: ReadonlyMap<string, MarkKind>): { end: number; pick: number }[] {
  const starts: { end: number; pick: number }[] = [];
  for (const [key, kind] of marks) {
    if (kind !== "start") continue;
    const [pick, end] = key.split(",").map(Number);
    if (pick !== undefined && end !== undefined) starts.push({ end, pick });
  }
  return starts.sort((a, b) => a.pick - b.pick || a.end - b.end);
}

/** The cell an engine error names, when it names both a pick and an end (10.4). */
export function errorCell(error: EngineError): { end: number; pick: number } | null {
  const record = error as unknown as Record<string, unknown>;
  const end = record["end"];
  const pick = record["pick"];
  return typeof end === "number" && typeof pick === "number" ? { end, pick } : null;
}
