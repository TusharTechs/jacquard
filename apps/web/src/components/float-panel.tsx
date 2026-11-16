// The float check (10.1 to 10.4): the violation count and list from the engine, auto-fix through
// the engine, AUTOFIX_FAILED with what remains, and engine errors in plain words.
import { useEffect, useState } from "react";
import type { LoomProfile } from "@jacquard/engine";
import type { CheckResult } from "../lib/engine-check";
import { engineNextStep } from "../lib/engine-messages";
import type { FixState } from "../lib/fix-state";
import { errorCell } from "../lib/violation-marks";
import { Term } from "./term";
import { Button } from "./ui/button";
import { Panel } from "./ui/panel";
import type { PanelStatus } from "./ui/panel";
import { FixReport } from "./fix-report";
import { ViolationList } from "./violation-list";

export interface FloatPanelProps {
  /** Null when there is no design to check. */
  readonly check: CheckResult | null;
  /** True while the shown result is for an older design than the one on screen. */
  readonly checking: boolean;
  readonly profile: LoomProfile;
  readonly fix: FixState;
  readonly canUndo: boolean;
  readonly onAutoFix: () => void;
  readonly onUndo: () => void;
  readonly onStartBlank: () => void;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

export function FloatPanel({ check, checking, profile, fix, canUndo, onAutoFix, onUndo, onStartBlank }: FloatPanelProps) {
  // Engine work that takes longer than 100 ms shows progress (design-language.md).
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!checking) {
      setSlow(false);
      return;
    }
    const timer = setTimeout(() => setSlow(true), 100);
    return () => clearTimeout(timer);
  }, [checking]);

  let status: PanelStatus = "ready";
  if (check === null) status = "empty";
  else if (!check.ok) status = "error";
  else if (slow) status = "loading";

  const cell = check !== null && !check.ok ? errorCell(check.error) : null;

  return (
    <Panel
      title="Float check"
      status={status}
      empty={
        <>
          <p className="state-title">Nothing to check yet</p>
          <p className="small">Paint the grid or generate a motif, and the float check runs after every change.</p>
          <div className="state-actions">
            <Button small onClick={onStartBlank}>
              Start from a blank grid
            </Button>
          </div>
        </>
      }
      loading={<p className="small">Checking floats…</p>}
      error={
        check !== null && !check.ok ? (
          <>
            <p className="state-title">The engine could not check this design</p>
            <p className="small">{check.error.message}</p>
            <p className="small">{engineNextStep(check.error)}</p>
            {cell === null ? null : (
              <p className="small">
                The cell at <span className="mono">end {cell.end} · pick {cell.pick}</span> is marked on the point paper with a
                cross.
              </p>
            )}
            <div className="state-actions">
              <Button small onClick={onUndo} disabled={!canUndo}>
                Undo last change
              </Button>
            </div>
          </>
        ) : undefined
      }
    >
      {check !== null && check.ok ? (
        <div className="stack">
          <p className="small muted">
            A <Term name="float">float</Term> may cross at most <span className="mono">{profile.maxWarpFloat}</span> picks
            (warp) and <span className="mono">{profile.maxWeftFloat}</span> ends (weft) on this profile.
          </p>
          {check.violations.length === 0 ? (
            <p className="status-line" role="status">
              <span className="marker-ok" aria-hidden="true" />
              No floats over the limit
            </p>
          ) : (
            <>
              <p className="status-line" role="status">
                <span className="marker-triangle" aria-hidden="true" />
                {plural(check.violations.length, "violation", "violations")}
              </p>
              <p className="small muted">Each is outlined on the point paper, with a triangle on its first cell.</p>
              <ViolationList violations={check.violations} label="Float violations" />
              <div className="state-actions">
                <Button variant="primary" onClick={onAutoFix}>
                  Auto-fix
                </Button>
              </div>
              <p className="small muted">
                Auto-fix flips cells of the <Term name="liftPlan">lift plan</Term>. Your regions on the point paper stay as they are.
              </p>
            </>
          )}
          {fix.status === "discarded" && check.violations.length === 0 ? null : <FixReport fix={fix} />}
        </div>
      ) : null}
    </Panel>
  );
}
