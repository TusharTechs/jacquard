// What auto-fix did (10.3): flipped cells and the fixed plan's count, AUTOFIX_FAILED with the
// violations left, another engine error, or a note that the fixed plan was discarded.
import type { FixState } from "../lib/fix-state";
import { engineNextStep } from "../lib/engine-messages";
import { ViolationList } from "./violation-list";

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

export function FixReport({ fix }: { readonly fix: FixState }) {
  switch (fix.status) {
    case "none":
      return null;
    case "discarded":
      return (
        <p className="note" role="status">
          The design, weaves or setup changed after auto-fix, so the fixed lift plan was discarded. Run auto-fix again before
          you export.
        </p>
      );
    case "fixed":
      return (
        <div className="note" role="status">
          <p>
            Auto-fix flipped <span className="mono">{plural(fix.flips.length, "lift-plan cell", "lift-plan cells")}</span>. The
            fixed lift plan has <span className="mono">{plural(fix.remaining, "violation", "violations")}</span>. It is kept for
            export; the point paper still shows the design before the fix.
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
        </div>
      );
    case "error":
      return (
        <div className="panel-state panel-error" role="alert">
          <p className="state-title">Auto-fix stopped with an error</p>
          <p className="small">{fix.error.message}</p>
          <p className="small">{engineNextStep(fix.error)}</p>
        </div>
      );
  }
}
