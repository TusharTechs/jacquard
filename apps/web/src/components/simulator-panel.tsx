// The fabric simulator (2.1 to 2.5): the Cloth_Model from @jacquard/export drawn on a canvas, face
// or back, zoom 1 to 16 px per cell, warp and weft yarn colours. It says which lift plan it shows
// and that it is a simulation, not a photograph. A large cloth is drawn in chunks, one per animation
// frame, and shows progress when drawing takes longer than 100 ms.
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { clothModel } from "@jacquard/export";
import type { LiftPlan, LoomProfile, Side } from "@jacquard/engine";
import { MAX_ZOOM, MIN_ZOOM, DEFAULT_ZOOM, clampZoom, clothCanvasSize, drawClothRows } from "../lib/draw-cloth";
import { yarnColours } from "../lib/yarns";
import type { YarnChoice } from "../lib/yarns";
import { Button } from "./ui/button";
import { Field } from "./ui/field";
import { Panel } from "./ui/panel";
import type { PanelStatus } from "./ui/panel";

export type PlanSource = "fixed" | "design";

export const SIMULATION_NOTE = "A simulation drawn from the lift plan, not a photograph of woven cloth.";

export const PLAN_LINES: Readonly<Record<PlanSource, string>> = {
  fixed: "Showing the fixed lift plan from auto-fix",
  design: "Showing the lift plan of the current design",
};

export interface SimulatorPanelProps {
  /** The plan to draw: the fixed plan when auto-fix is current, else the design's. Null when there is none. */
  readonly plan: LiftPlan | null;
  readonly planSource: PlanSource;
  readonly profile: LoomProfile;
  readonly yarns: YarnChoice;
  readonly onYarnsChange: (yarns: YarnChoice) => void;
  readonly onResetYarns: () => void;
  /** Why there is no plan: nothing painted yet, or the engine could not build one. */
  readonly emptyReason: "blank" | "engineError";
  readonly onStartBlank: () => void;
}

/** Picks drawn per frame are limited by time, so a large cloth never blocks input for long. */
const FRAME_BUDGET_MS = 12;
/** Drawing that takes longer than this shows progress (design-language.md). */
const SLOW_MS = 100;

type Schedule = (callback: () => void) => () => void;

const schedule: Schedule = (callback) => {
  if (typeof requestAnimationFrame === "function") {
    const handle = requestAnimationFrame(() => callback());
    return () => cancelAnimationFrame(handle);
  }
  const timer = setTimeout(callback, 16);
  return () => clearTimeout(timer);
};

function now(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

export function SimulatorPanel({
  plan,
  planSource,
  profile,
  yarns,
  onYarnsChange,
  onResetYarns,
  emptyReason,
  onStartBlank,
}: SimulatorPanelProps) {
  const zoomId = useId();
  const [side, setSide] = useState<Side>("face");
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [attempt, setAttempt] = useState(0);
  const [drawing, setDrawing] = useState(false);
  const [slow, setSlow] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [ratio] = useState(() => (typeof window === "undefined" ? 1 : window.devicePixelRatio || 1));

  const model = useMemo(
    () => (plan === null ? null : clothModel(plan, profile, yarnColours(yarns), side)),
    // `attempt` reruns the model on Retry.
    [plan, profile, yarns.warp, yarns.weft, side, attempt],
  );
  const cells = model !== null && model.ok ? model.value : null;
  const hookCount = cells?.[0]?.length ?? 0;
  const pickCount = cells?.length ?? 0;
  const size = clothCanvasSize(hookCount, pickCount, zoom, ratio);

  // Redraw when the cloth, the zoom or the pixel ratio change (2.3).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null || cells === null) return;
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (context === null) return;
    const cell = clampZoom(zoom);
    context.setTransform(size.width / Math.max(1, size.cssWidth), 0, 0, size.height / Math.max(1, size.cssHeight), 0, 0);
    let pick = 0;
    let cancelled = false;
    let cancelFrame: (() => void) | null = null;
    setDrawing(true);
    const slowTimer = setTimeout(() => {
      if (!cancelled) setSlow(true);
    }, SLOW_MS);
    const finish = (): void => {
      clearTimeout(slowTimer);
      setDrawing(false);
      setSlow(false);
    };
    const step = (): void => {
      if (cancelled) return;
      const started = now();
      while (pick < cells.length && now() - started < FRAME_BUDGET_MS) {
        drawClothRows(context, cells, cell, pick, pick + 1);
        pick += 1;
      }
      if (pick < cells.length) cancelFrame = schedule(step);
      else finish();
    };
    cancelFrame = schedule(step);
    return () => {
      cancelled = true;
      clearTimeout(slowTimer);
      cancelFrame?.();
    };
  }, [cells, zoom, size.width, size.height, size.cssWidth, size.cssHeight]);

  let status: PanelStatus = "ready";
  if (plan === null) status = "empty";
  else if (model !== null && !model.ok) status = "error";
  else if (drawing && slow) status = "loading";

  return (
    <Panel
      title="Cloth simulation"
      status={status}
      empty={
        emptyReason === "blank" ? (
          <>
            <p className="state-title">No cloth to show yet</p>
            <p className="small">
              The simulated cloth appears here once there is a design. Paint the grid or generate a motif, and the cloth is
              drawn from its lift plan.
            </p>
            <div className="state-actions">
              <Button small onClick={onStartBlank}>
                Start from a blank grid
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="state-title">No lift plan to simulate</p>
            <p className="small">
              The engine could not build a lift plan for this design. The float check says what to change; the cloth appears
              here as soon as the design can be woven on this profile.
            </p>
          </>
        )
      }
      loading={
        <>
          <p className="small">Drawing the cloth…</p>
          <div className="progress" aria-hidden="true" />
        </>
      }
      error={
        model !== null && !model.ok ? (
          <>
            <p className="state-title">The cloth could not be drawn</p>
            <p className="small">{model.error.message}</p>
            <p className="small">Choose other yarn colours or reset them, then try again. Your design is unchanged.</p>
            <div className="state-actions">
              <Button small onClick={() => setAttempt((count) => count + 1)}>
                Retry
              </Button>
              <Button small onClick={onResetYarns}>
                Reset yarn colours
              </Button>
            </div>
          </>
        ) : undefined
      }
    >
      <div className="stack">
        <p className="small muted">{SIMULATION_NOTE}</p>
        {plan === null ? null : (
          <>
            <p className="status-line small" role="status">
              {PLAN_LINES[planSource]}
            </p>
            <div className="toolbar-group" role="group" aria-label="Side of the cloth">
              <span className="small">Side:</span>
              <Button small variant={side === "face" ? "primary" : "secondary"} aria-pressed={side === "face"} onClick={() => setSide("face")}>
                Face
              </Button>
              <Button small variant={side === "back" ? "primary" : "secondary"} aria-pressed={side === "back"} onClick={() => setSide("back")}>
                Back
              </Button>
            </div>
            <div className="toolbar-zoom">
              <label htmlFor={zoomId} className="small">
                Zoom <span className="mono">{zoom}px</span> per cell
              </label>
              <input
                id={zoomId}
                type="range"
                min={MIN_ZOOM}
                max={MAX_ZOOM}
                step={1}
                value={zoom}
                onChange={(event) => setZoom(clampZoom(Number(event.target.value)))}
              />
            </div>
            <div className="grid-2">
              <Field label="Warp yarn colour">
                {(control) => (
                  <input
                    {...control}
                    type="color"
                    className="input input-colour"
                    value={yarns.warp}
                    onChange={(event) => onYarnsChange({ ...yarns, warp: event.target.value })}
                  />
                )}
              </Field>
              <Field label="Weft yarn colour" hint="Starts as region 0's colour.">
                {(control) => (
                  <input
                    {...control}
                    type="color"
                    className="input input-colour"
                    value={yarns.weft}
                    onChange={(event) => onYarnsChange({ ...yarns, weft: event.target.value })}
                  />
                )}
              </Field>
            </div>
            {cells === null ? null : (
              <>
                <div className="cloth-viewport">
                  <canvas
                    ref={canvasRef}
                    className="cloth-canvas"
                    data-side={side}
                    style={{ width: `${size.cssWidth}px`, height: `${size.cssHeight}px` }}
                    role="img"
                    aria-label={`Simulated cloth, ${side} side, ${hookCount} ends by ${pickCount} picks`}
                  />
                </div>
                <p className="small muted">
                  <span className="mono">{hookCount}</span> ends by <span className="mono">{pickCount}</span> picks. Pick 0 is at the
                  bottom and end 0 at the left on both sides.
                </p>
              </>
            )}
          </>
        )}
      </div>
    </Panel>
  );
}
