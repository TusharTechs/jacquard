// Where to draw the engine's violations and errors on the point paper. Display only: the
// violations themselves come from the engine's checkFloats, unchanged.
import type { EngineError, Violation } from "@jacquard/engine";

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

/** The cell an engine error names, when it names both a pick and an end (10.4). */
export function errorCell(error: EngineError): { end: number; pick: number } | null {
  const record = error as unknown as Record<string, unknown>;
  const end = record["end"];
  const pick = record["pick"];
  return typeof end === "number" && typeof pick === "number" ? { end, pick } : null;
}
