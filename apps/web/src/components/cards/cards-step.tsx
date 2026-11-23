// The Cards Step (studio-experience Requirement 12): the card chain drawn from the engine's
// buildCards, "Print cards" first, and its states. The export panel sits beside it, unchanged.
// With nothing on the grid it offers the way back to Design; without a lift plan, the float check.
import { Printer } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { buildCards } from "@jacquard/engine";
import type { LiftPlan, LoomProfile } from "@jacquard/engine";
import { engineNextStep } from "../../lib/engine-messages";
import type { PlanSource } from "../simulator-panel";
import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";
import { Panel } from "../ui/panel";
import type { PanelStatus } from "../ui/panel";
import { CardChain } from "./card-chain";
import { PrintSheet } from "./print-sheet";

export interface CardsStepProps {
  readonly plan: LiftPlan | null;
  readonly profile: LoomProfile;
  readonly profileName: string;
  /** True while there is nothing on the grid yet. */
  readonly blank: boolean;
  readonly onOpenGallery: () => void;
  readonly onGoToDesign: () => void;
  readonly onGoToFloatCheck: () => void;
  /** Which plan the cards come from: the fixed plan when auto-fix is current. */
  readonly planSource: PlanSource;
  /** Float violations in the design's plan. */
  readonly violationCount: number;
  /** True while the float check still describes an older design than the one on the grid. */
  readonly checking: boolean;
  readonly onAutoFix: () => void;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

export function CardsStep({
  plan,
  profile,
  profileName,
  blank,
  onOpenGallery,
  onGoToDesign,
  onGoToFloatCheck,
  planSource,
  violationCount,
  checking,
  onAutoFix,
}: CardsStepProps) {
  const built = useMemo(() => (plan === null ? null : buildCards(plan, profile)), [plan, profile]);
  const cards = built !== null && built.ok ? built.value.cards : null;
  const [printing, setPrinting] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  // Like the export panel (simulate-and-export 6.2): never print long floats without asking.
  const gated = violationCount > 0 && planSource !== "fixed";

  // The browser's own print command prints the card set too.
  useEffect(() => {
    const before = (): void => flushSync(() => setPrinting(true));
    const after = (): void => setPrinting(false);
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => {
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
    };
  }, []);

  const printNow = useCallback((): void => {
    flushSync(() => setPrinting(true));
    window.print();
  }, []);
  const print = (): void => {
    if (checking) return;
    if (gated) {
      setConfirm(true);
      return;
    }
    printNow();
  };
  const planLine =
    planSource === "fixed"
      ? "Printed from the fixed lift plan from auto-fix."
      : gated
        ? `Printed from the design's lift plan, which has ${plural(violationCount, "float violation", "float violations")}.`
        : "Printed from the lift plan of the current design.";

  let status: PanelStatus = "ready";
  if (blank) status = "empty";
  else if (cards === null) status = "error";

  return (
    <Panel
      title="Card chain"
      headingRef={headingRef}
      status={status}
      actions={
        cards === null ? undefined : (
          <Button variant="primary" onClick={print} aria-disabled={checking ? true : undefined}>
            <Printer aria-hidden="true" size={18} />
            Print cards
          </Button>
        )
      }
      empty={
        <>
          <p className="state-title">No cards yet</p>
          <p className="small">Cards come from the design: one card per pick.</p>
          <div className="state-actions">
            <Button small variant="primary" onClick={onOpenGallery}>
              Open a gallery example
            </Button>
            <Button small onClick={onGoToDesign}>
              Go to Design
            </Button>
          </div>
        </>
      }
      error={
        <>
          <p className="state-title">No lift plan to punch</p>
          <p className="small">
            {built !== null && !built.ok ? `${built.error.message} ${engineNextStep(built.error)}` : "The engine could not build a lift plan for this design."}
          </p>
          <div className="state-actions">
            <Button small onClick={onGoToFloatCheck}>
              Go to the float check
            </Button>
          </div>
        </>
      }
    >
      {status === "ready" && cards !== null ? (
        <div className="stack">
          {checking ? (
            <p className="status-line small">Checking floats…</p>
          ) : gated ? (
            <p className="status-line small">
              <span className="marker-triangle" aria-hidden="true" />
              {plural(violationCount, "float violation", "float violations")} in the lift plan. Print asks first.
            </p>
          ) : null}
          <CardChain cards={cards} profile={profile} />
        </div>
      ) : null}
      {printing ? (
        <PrintSheet
          cards={cards ?? []}
          profile={profile}
          title={`JACQUARD card set, ${profileName}-hook loom profile`}
          planLine={cards === null ? (blank ? "There is no design to print yet." : "The engine could not build a lift plan for this design.") : planLine}
        />
      ) : null}
      <Dialog open={confirm} title="The float check reports violations" closeLabel="Cancel" onClose={() => setConfirm(false)} fallbackFocus={headingRef}>
        <div className="stack">
          <p>
            The lift plan has {plural(violationCount, "float violation", "float violations")}. Cards printed from it carry those long
            floats. Auto-fix can flip lift-plan cells to remove them; your regions stay as they are.
          </p>
          <div className="state-actions">
            <Button
              variant="primary"
              onClick={() => {
                setConfirm(false);
                onAutoFix();
              }}
            >
              Run auto-fix
            </Button>
            <Button
              onClick={() => {
                setConfirm(false);
                printNow();
              }}
            >
              Print anyway
            </Button>
          </div>
        </div>
      </Dialog>
    </Panel>
  );
}
