// What auto-fix did (10.3): flipped cells and the fixed plan's count, AUTOFIX_FAILED with the
// violations left, another engine error, or a note that the fixed plan was discarded.
import type { FixState } from "../lib/fix-state";
import { engineNextStep } from "../lib/engine-messages";
import { Button } from "./ui/button";
import { ViolationList } from "./violation-list";

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

export interface FixReportProps {
  readonly fix: FixState;
  /** Undo the last edit of the design. */
  readonly onUndo?: () => void;
  readonly canUndo?: boolean;
  /** Focus the point paper and move its cursor to the next violation, as N does. */
  readonly onNextViolation?: () => void;
  readonly hasViolations?: boolean;
  /** Run auto-fix again (for the `error` state). */
  readonly onRetry?: () => void;
}

export function FixReport({ fix, onUndo, canUndo = false, onNextViolation, hasViolations = false, onRetry }: FixReportProps) {
  const actions = (retry: boolean) =>
    onUndo === undefined && onNextViolation === undefined && (!retry || onRetry === undefined) ? null : (
      <div className="state-actions">
        {retry && onRetry !== undefined ? (
          <Button small variant="primary" onClick={onRetry}>
            Retry
          </Button>
        ) : null}
        {onUndo === undefined ? null : (
          <Button small onClick={onUndo} disabled={!canUndo}>
            Undo last change
          </Button>
        )}
        {onNextViolation === undefined ? null : (
          <Button small onClick={onNextViolation} disabled={!hasViolations}>
            Go to next violation
          </Button>
        )}
      </div>
    );
  switch (fix.status) {
    case "none":
      return null;
    case "discarded":
      return (
        <p className="note" role="status">
          The design, weaves or setup changed after auto-fix, so the fixed lift plan was discarded. Run auto-fix again if
          the float check still shows violations.
        </p>
      );
    case "fixed":
      return (
        <div className="note">
          <p>
            Auto-fix flipped <span className="mono">{plural(fix.flips.length, "lift-plan cell", "lift-plan cells")}</span>. The
            fixed lift plan has <span className="mono">{plural(fix.remaining, "violation", "violations")}</span>. It is kept until
            you edit the design, the weaves or the setup. Your regions on the point paper are unchanged; choose “Auto-fix
            changes” above the grid to see the flipped cells, each marked with a diamond.
          </p>
        </div>
      );
    case "failed":
      return (
        <div className="panel-state panel-error" role="alert">
          <p className="state-title">Auto-fix could not remove every violation</p>
          <p className="small">{fix.error.message}</p>
          <p className="small">{engineNextStep(fix.error)}</p>
          <ViolationList violations={fix.error.remaining} label="Violations left after auto-fix" />
          {actions(false)}
        </div>
      );
    case "error":
      return (
        <div className="panel-state panel-error" role="alert">
          <p className="state-title">Auto-fix stopped with an error</p>
          <p className="small">{fix.error.message}</p>
          <p className="small">{engineNextStep(fix.error)}</p>
          {actions(true)}
        </div>
      );
  }
}
