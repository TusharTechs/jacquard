// The Cards Step (studio-experience Requirement 12): the card chain and its states. The export
// panel sits beside it, unchanged. With nothing on the grid it offers the way back to Design;
// without a lift plan it offers the float check.
import type { ReactNode } from "react";
import type { LiftPlan } from "@jacquard/engine";
import { Button } from "../ui/button";
import { Panel } from "../ui/panel";
import type { PanelStatus } from "../ui/panel";

export interface CardsStepProps {
  readonly plan: LiftPlan | null;
  /** True while there is nothing on the grid yet. */
  readonly blank: boolean;
  readonly onOpenGallery: () => void;
  readonly onGoToDesign: () => void;
  readonly onGoToFloatCheck: () => void;
  readonly children?: ReactNode;
}

export function CardsStep({ plan, blank, onOpenGallery, onGoToDesign, onGoToFloatCheck, children }: CardsStepProps) {
  let status: PanelStatus = "ready";
  if (blank) status = "empty";
  else if (plan === null) status = "error";
  return (
    <Panel
      title="Card chain"
      status={status}
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
          <p className="small">The engine could not build a lift plan for this design.</p>
          <div className="state-actions">
            <Button small onClick={onGoToFloatCheck}>
              Go to the float check
            </Button>
          </div>
        </>
      }
    >
      {status === "ready" ? children : null}
    </Panel>
  );
}
