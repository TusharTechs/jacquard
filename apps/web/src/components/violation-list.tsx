// A list of the engine's violations in monospace: direction, side, pick, end and length (10.2).
import type { Violation } from "@jacquard/engine";

/** Longer lists are cut here, with a count of the rest [decision]. */
export const LIST_LIMIT = 200;

export function violationText(violation: Violation): string {
  if (violation.kind === "unbound") {
    const line = violation.direction === "warp" ? `end ${violation.line}` : `pick ${violation.line}`;
    return `${violation.direction} · ${violation.side} · ${line} unbound · length ${violation.length}`;
  }
  return `${violation.direction} · ${violation.side} · pick ${violation.pick} · end ${violation.end} · length ${violation.length}`;
}

export interface ViolationListProps {
  readonly violations: readonly Violation[];
  readonly label: string;
}

export function ViolationList({ violations, label }: ViolationListProps) {
  const shown = violations.slice(0, LIST_LIMIT);
  return (
    <>
      <ul className="violation-list" aria-label={label}>
        {shown.map((violation, index) => (
          <li key={index}>{violationText(violation)}</li>
        ))}
      </ul>
      {violations.length > shown.length ? (
        <p className="small muted">
          And <span className="mono">{violations.length - shown.length}</span> more.
        </p>
      ) : null}
    </>
  );
}
