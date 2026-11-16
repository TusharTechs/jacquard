// The float check (10.1 to 10.4): the violation count and list from the engine, auto-fix through
// the engine, AUTOFIX_FAILED with what remains, and engine errors in plain words. After a
// successful auto-fix the fixed lift plan is the headline and the earlier list folds away.
import { useEffect, useState } from "react";
import type { Ref } from "react";
import type { EngineError, LoomProfile } from "@jacquard/engine";
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
  /** Focus the point paper and move its cursor to the next violation, as N does. */
  readonly onNextViolation?: () => void;
  /** REPEAT_NOT_DIVISIBLE: switch "repeat across" off in the loom setup. */
  readonly onTurnOffRepeatAcross: () => void;
  /** DESIGN_TOO_WIDE: open the loom setup and focus the profile select. */
  readonly onChooseProfile: () => void;
  /** The panel heading, so other panels can move focus here. */
  readonly headingRef?: Ref<HTMLHeadingElement>;
}

interface ErrorAction {
  readonly label: string;
  readonly run: () => void;
  readonly disabled: boolean;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

export function FloatPanel({
  check,
  checking,
  profile,
  fix,
  canUndo,
  onAutoFix,
  onUndo,
  onNextViolation,
  onTurnOffRepeatAcross,
  onChooseProfile,
  headingRef,
}: FloatPanelProps) {
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
  const errorAction = (error: EngineError): ErrorAction => {
    switch (error.code) {
      case "REPEAT_NOT_DIVISIBLE":
        return { label: "Turn off repeat across", run: onTurnOffRepeatAcross, disabled: false };
      case "DESIGN_TOO_WIDE":
        return { label: "Choose a larger profile", run: onChooseProfile, disabled: false };
      default:
        return { label: "Undo last change", run: onUndo, disabled: !canUndo };
    }
  };
  const action = check !== null && !check.ok ? errorAction(check.error) : null;
  const fixed = fix.status === "fixed" ? fix : null;

  return (
    <Panel
      title="Float check"
      headingRef={headingRef}
      status={status}
      empty={
        <p className="small">Nothing to check yet. The float check runs once there is a design on the point paper.</p>
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
            {action === null ? null : (
              <div className="state-actions">
                <Button small onClick={action.run} disabled={action.disabled}>
                  {action.label}
                </Button>
              </div>
            )}
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
          {fixed !== null ? (
            <>
              <p className="status-line" role="status">
                <span className="marker-ok" aria-hidden="true" />
                Fixed lift plan: {plural(fixed.remaining, "violation", "violations")} ·{" "}
                {plural(fixed.flips.length, "cell", "cells")} flipped
              </p>
              <FixReport fix={fix} />
              {check.violations.length === 0 ? null : (
                <details className="before-fix">
                  <summary>Before auto-fix ({check.violations.length})</summary>
                  <ViolationList violations={check.violations} label="Float violations" />
                </details>
              )}
            </>
          ) : check.violations.length === 0 ? (
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
          {fixed !== null || (fix.status === "discarded" && check.violations.length === 0) ? null : (
            <FixReport
              fix={fix}
              onUndo={onUndo}
              canUndo={canUndo}
              {...(onNextViolation === undefined ? {} : { onNextViolation })}
              hasViolations={check.violations.length > 0}
              onRetry={onAutoFix}
            />
          )}
        </div>
      ) : null}
    </Panel>
  );
}
