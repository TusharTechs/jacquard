// The Weave Step (studio-experience Requirements 6 to 8): the 3D loom, its transport and a text
// equivalent. The loom model comes from lib/loom-model.ts (engine cards, export cloth). One clock
// drives both the scene and the transport: a requestAnimationFrame loop moves `timeRef` every
// frame, and React state changes only once per pick, so the readout and card strip re-render
// about twice a second. The three.js scene is a lazy chunk that stays mounted after the first
// visit; without WebGL the Step still plays.
import * as Slider from "@radix-ui/react-slider";
import { Pause, Play, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react";
import { Component, Suspense, lazy, useCallback, useEffect, useId, useMemo, useReducer, useRef, useState } from "react";
import type { ErrorInfo, ReactNode } from "react";
import type { LiftPlan, LoomProfile } from "@jacquard/engine";
import type { YarnColours } from "@jacquard/export";
import { engineNextStep } from "../../lib/engine-messages";
import { buildLoomModel, cardStrip, liftedCount, loomFrame } from "../../lib/loom-model";
import type { LoomModel, PhaseName } from "../../lib/loom-model";
import { OPEN_SHED, SPEEDS, initialTransport, transportReducer } from "../../lib/loom-transport";
import type { Speed } from "../../lib/loom-transport";
import type { LoomSound } from "../../lib/loom-sound";
import { useReducedMotion } from "../../lib/reduced-motion";
import { CardFace } from "../cards/card-face";
import { PLAN_LINES } from "../simulator-panel";
import type { PlanSource } from "../simulator-panel";
import { Button } from "../ui/button";
import { IconButton } from "../ui/icon-button";
import { Panel } from "../ui/panel";
import type { PanelStatus } from "../ui/panel";
import { notify } from "../ui/toaster";

export const LOOM_NOTE = "A stylised loom, not to scale. The card format has not been tested on a working loom.";
export const NO_WEBGL_MESSAGE = "The 3D loom could not start on this device. The card, readout and controls still work.";
export const LOAD_FAILED_MESSAGE = "The 3D loom could not load. Check the connection and try again.";

const loadScene = () => import("./loom-scene");

/** Starts loading the 3D loom early, for example when the pointer rests on the Weave rail item. */
export function prefetchLoomScene(): void {
  void loadScene().catch(() => undefined);
}

export function webglAvailable(): boolean {
  if (typeof window === "undefined" || typeof WebGL2RenderingContext === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return canvas.getContext("webgl2") !== null;
  } catch {
    return false;
  }
}

/** A dynamic import that failed (offline, a new deploy), as opposed to WebGL failing. */
function isChunkError(error: unknown): boolean {
  const text = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return /dynamically imported module|Importing a module script failed|Failed to fetch|ChunkLoadError|error loading dynamically/i.test(text);
}

interface BoundaryProps {
  readonly children: ReactNode;
  readonly render: (kind: "chunk" | "webgl") => ReactNode;
}

class SceneBoundary extends Component<BoundaryProps, { readonly failed: "chunk" | "webgl" | null }> {
  override state: { readonly failed: "chunk" | "webgl" | null } = { failed: null };
  static getDerivedStateFromError(error: unknown): { failed: "chunk" | "webgl" } {
    return { failed: isChunkError(error) ? "chunk" : "webgl" };
  }
  override componentDidCatch(_error: unknown, _info: ErrorInfo): void {
    // The fallback says what happened; nothing to log for the user.
  }
  override render(): ReactNode {
    return this.state.failed === null ? this.props.children : this.props.render(this.state.failed);
  }
}

export interface WeaveStepProps {
  readonly plan: LiftPlan | null;
  readonly planSource: PlanSource;
  readonly profile: LoomProfile;
  readonly yarns: YarnColours;
  /** Float violations in the design's plan while no fixed plan is current. */
  readonly violationCount: number;
  /** True while the Weave Step is on screen. */
  readonly visible: boolean;
  readonly emptyReason: "blank" | "engineError";
  readonly onGoToFloatCheck: () => void;
  readonly onOpenGallery: () => void;
  /** For tests: whether to try the 3D scene. */
  readonly webgl?: boolean;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

export function WeaveStep({ plan, planSource, profile, yarns, violationCount, visible, emptyReason, onGoToFloatCheck, onOpenGallery, webgl }: WeaveStepProps) {
  const reduced = useReducedMotion();
  // The model is built once the Step has been opened, not while painting in Design.
  const [opened, setOpened] = useState(visible);
  useEffect(() => {
    if (visible) setOpened(true);
  }, [visible]);
  const built = useMemo(() => (plan === null || !opened ? null : buildLoomModel(plan, profile, yarns)), [plan, profile, yarns, opened]);
  const model: LoomModel | null = built !== null && built.ok ? built.value : null;
  const pickCount = model?.pickCount ?? 0;
  const [state, dispatch] = useReducer(transportReducer, 0, (count: number) => initialTransport(count, false));
  const timeRef = useRef(state.t);
  const [canUse3d] = useState(() => webgl ?? webglAvailable());
  const [sceneReady, setSceneReady] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const LoomScene = useMemo(() => lazy(loadScene), [attempt]);
  const [soundOn, setSoundOn] = useState(false);
  const [soundLoading, setSoundLoading] = useState(false);
  const sound = useRef<LoomSound | null>(null);
  const soundRequest = useRef(0);
  const lastPhase = useRef<{ pick: number; phase: PhaseName } | null>(null);
  const autoplayed = useRef(false);
  const [announcement, setAnnouncement] = useState("");
  const labelId = useId();
  const speedLabelId = useId();

  const stopSound = useCallback((): void => {
    soundRequest.current += 1;
    sound.current?.dispose();
    sound.current = null;
    setSoundOn(false);
    setSoundLoading(false);
  }, []);

  // A new plan starts again at pick 0: playing if the loom was already weaving on screen.
  useEffect(() => {
    lastPhase.current = null;
    const play = visible && !reduced && autoplayed.current;
    const next = initialTransport(pickCount, play);
    timeRef.current = next.t;
    dispatch({ type: "reset", pickCount, playing: play });
  }, [model]);

  // The first time the Step shows a plan, the loom starts weaving (3.4), unless motion is reduced (7.5).
  useEffect(() => {
    if (!visible || autoplayed.current || pickCount === 0) return;
    autoplayed.current = true;
    if (!reduced) {
      timeRef.current = 0;
      dispatch({ type: "seek", t: 0 });
      dispatch({ type: "play" });
    }
  }, [visible, reduced, pickCount]);

  // Hidden Step: pause and silence (6.8, 8.4).
  useEffect(() => {
    if (!visible) {
      dispatch({ type: "pause" });
      stopSound();
    }
  }, [visible, stopSound]);

  const playSounds = useCallback(
    (t: number) => {
      if (model === null || sound.current === null) return;
      const frame = loomFrame(model, t);
      const last = lastPhase.current;
      if (last === null || last.pick !== frame.pick || last.phase !== frame.phase) {
        lastPhase.current = { pick: frame.pick, phase: frame.phase };
        sound.current.onPhase(frame.phase);
      }
    },
    [model],
  );

  // The clock. Runs only while playing, on screen and with the scene ready (or without 3D). With
  // reduced motion it moves one whole pick at a time, each shown with its shed open.
  const ready = !canUse3d || sceneReady;
  useEffect(() => {
    if (!state.playing || !visible || model === null || !ready) return;
    let frameId = 0;
    let previous: number | null = null;
    let carry = 0;
    const step = (now: number): void => {
      const seconds = previous === null ? 0 : Math.min(0.1, (now - previous) / 1000);
      previous = now;
      const before = Math.floor(timeRef.current);
      let t: number;
      if (reduced) {
        carry += seconds * state.speed * 2;
        if (carry < 1) {
          frameId = requestAnimationFrame(step);
          return;
        }
        carry -= 1;
        t = Math.min(model.pickCount, before + 1 + OPEN_SHED);
      } else {
        t = Math.min(model.pickCount, timeRef.current + seconds * state.speed * 2);
      }
      timeRef.current = t;
      playSounds(t);
      if (t >= model.pickCount || Math.floor(t) >= model.pickCount) {
        timeRef.current = model.pickCount;
        dispatch({ type: "seek", t: model.pickCount });
        dispatch({ type: "pause" });
        return;
      }
      if (Math.floor(t) !== before) dispatch({ type: "seek", t });
      frameId = requestAnimationFrame(step);
    };
    frameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameId);
  }, [state.playing, state.speed, visible, model, ready, reduced, playSounds]);

  const frame = model === null ? null : loomFrame(model, state.t);
  const pick = frame?.pick ?? 0;
  const lifted = model === null ? 0 : liftedCount(model, pick);
  const spoken = (at: number): string => {
    if (model === null) return "";
    const count = liftedCount(model, at);
    return `Card ${at + 1} of ${pickCount}, pick ${at}, ${plural(count, "hook", "hooks")} lifted`;
  };

  const pause = (): void => {
    if (state.playing) {
      dispatch({ type: "pause" });
      setAnnouncement(spoken(pick));
    }
  };
  const seekPick = (target: number, announce: boolean): void => {
    const next = transportReducer(state, { type: "seekPick", pick: target });
    timeRef.current = next.t;
    dispatch({ type: "pause" });
    dispatch({ type: "seek", t: next.t });
    if (announce) setAnnouncement(spoken(Math.floor(next.t)));
  };
  const stepBy = (by: 1 | -1): void => {
    if ((by === -1 && pick === 0) || (by === 1 && pick >= pickCount - 1)) return;
    const next = transportReducer(state, { type: "step", by });
    timeRef.current = next.t;
    dispatch({ type: "step", by });
    setAnnouncement(spoken(Math.floor(next.t)));
  };
  const toggle = (): void => {
    if (state.playing) {
      pause();
      return;
    }
    if (timeRef.current >= pickCount) timeRef.current = 0;
    dispatch({ type: "play" });
  };
  const toggleSound = async (): Promise<void> => {
    if (soundLoading) return;
    if (soundOn) {
      stopSound();
      return;
    }
    const request = soundRequest.current + 1;
    soundRequest.current = request;
    setSoundOn(true);
    setSoundLoading(true);
    try {
      const { createLoomSound } = await import("../../lib/loom-sound");
      const made = await createLoomSound();
      // Turned off, or the Step was left, while it loaded: drop it.
      if (soundRequest.current !== request) {
        made.dispose();
        return;
      }
      sound.current = made;
      setSoundLoading(false);
    } catch {
      if (soundRequest.current === request) {
        setSoundOn(false);
        setSoundLoading(false);
        notify("Sound could not start in this browser. The loom keeps weaving silently.");
      }
    }
  };
  useEffect(() => () => {
    soundRequest.current += 1;
    sound.current?.dispose();
  }, []);

  const strip = model === null ? [] : cardStrip(pickCount, pick, 1, 3);

  let status: PanelStatus = "ready";
  if (plan === null) status = "empty";
  else if (built !== null && !built.ok) status = "error";
  const buildError = built !== null && !built.ok ? built.error : null;

  const fallback = (kind: "chunk" | "webgl"): ReactNode => (
    <div className="loom-stage loom-stage-fallback" role="note">
      <p className="small">{kind === "chunk" ? LOAD_FAILED_MESSAGE : NO_WEBGL_MESSAGE}</p>
      {kind === "chunk" ? (
        <Button small onClick={() => setAttempt((value) => value + 1)}>
          Retry
        </Button>
      ) : null}
    </div>
  );

  return (
    <Panel
      title="Loom"
      className="weave-panel"
      status={status}
      empty={
        emptyReason === "blank" ? (
          <>
            <p className="state-title">Nothing to weave yet</p>
            <p className="small">The loom weaves the design on the point paper, one card per pick.</p>
            <div className="state-actions">
              <Button small onClick={onOpenGallery}>
                Open a gallery example
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="state-title">No lift plan to weave</p>
            <p className="small">The engine could not build a lift plan for this design.</p>
            <div className="state-actions">
              <Button small onClick={onGoToFloatCheck}>
                Go to the float check
              </Button>
            </div>
          </>
        )
      }
      error={
        buildError === null ? undefined : (
          <>
            <p className="state-title">The loom could not be set up</p>
            <p className="small">{buildError.message}</p>
            <p className="small">
              {buildError.code === "YARN_INVALID"
                ? "Change the yarn colours in the cloth simulation on the Check step."
                : engineNextStep(buildError as Parameters<typeof engineNextStep>[0])}
            </p>
            <div className="state-actions">
              <Button small onClick={onGoToFloatCheck}>
                Go to the float check
              </Button>
            </div>
          </>
        )
      }
    >
      {model === null || frame === null ? null : (
        <div className="weave-layout">
          <div className="loom-frame">
            {canUse3d && opened ? (
              <SceneBoundary key={attempt} render={fallback}>
                <Suspense
                  fallback={
                    <div className="loom-stage loom-stage-loading" role="status">
                      <span className="page-loading-holes" aria-hidden="true" />
                      <span className="small">Setting up the loom…</span>
                    </div>
                  }
                >
                  <LoomScene
                    model={model}
                    yarns={yarns}
                    timeRef={timeRef}
                    playing={state.playing}
                    t={state.t}
                    active={visible}
                    onReady={() => setSceneReady(true)}
                  />
                </Suspense>
              </SceneBoundary>
            ) : (
              fallback("webgl")
            )}
            <p className="loom-note">{LOOM_NOTE}</p>
          </div>

          <div className="loom-side">
            <div className="loom-controls">
              <div className="loom-transport" role="group" aria-label="Loom controls">
                <IconButton icon={SkipBack} label="Previous pick" onClick={() => stepBy(-1)} aria-disabled={pick === 0 ? true : undefined} />
                <Button className="loom-play" onClick={toggle} aria-label={state.playing ? "Pause" : "Play"}>
                  {state.playing ? <Pause aria-hidden="true" size={18} /> : <Play aria-hidden="true" size={18} />}
                  {state.playing ? "Pause" : "Play"}
                </Button>
                <IconButton icon={SkipForward} label="Next pick" onClick={() => stepBy(1)} aria-disabled={pick >= pickCount - 1 ? true : undefined} />
                <IconButton
                  icon={soundOn ? Volume2 : VolumeX}
                  label="Sound"
                  aria-pressed={soundOn}
                  aria-busy={soundLoading ? true : undefined}
                  onClick={() => void toggleSound()}
                />
              </div>

              {pickCount < 2 ? null : (
                <div className="loom-scrub">
                  <span className="field-label" id={labelId}>
                    Pick
                  </span>
                  <Slider.Root
                    className="slider"
                    min={0}
                    max={pickCount - 1}
                    step={1}
                    value={[pick]}
                    onValueChange={([value]) => {
                      if (value !== undefined) seekPick(value, false);
                    }}
                  >
                    <Slider.Track className="slider-track">
                      <Slider.Range className="slider-range" />
                    </Slider.Track>
                    <Slider.Thumb
                      className="slider-thumb"
                      aria-labelledby={labelId}
                      aria-valuetext={`Pick ${pick}, card ${frame.cardNumber} of ${pickCount}, ${plural(lifted, "hook", "hooks")} lifted`}
                      onFocus={pause}
                    />
                  </Slider.Root>
                </div>
              )}

              <div className="loom-speeds" role="group" aria-labelledby={speedLabelId}>
                <span className="field-label" id={speedLabelId}>
                  Speed
                </span>
                {SPEEDS.map((speed: Speed) => (
                  <Button key={speed} small aria-pressed={state.speed === speed} onClick={() => dispatch({ type: "setSpeed", speed })}>
                    <span className="mono">{speed}×</span>
                  </Button>
                ))}
              </div>
            </div>

            <p className="status-line small">{PLAN_LINES[planSource]}</p>
            {violationCount > 0 && planSource !== "fixed" ? (
              <p className="small loom-violations">
                <span className="marker-triangle" aria-hidden="true" /> {plural(violationCount, "float violation", "float violations")} in
                this plan.{" "}
                <button type="button" className="link-button" onClick={onGoToFloatCheck}>
                  Go to the float check
                </button>
              </p>
            ) : null}

            <p className="loom-readout mono">
              <span className="loom-card-number">Card {frame.cardNumber}</span>{" "}
              <span>
                of {pickCount} · pick {pick} · {plural(lifted, "hook", "hooks")} lifted
              </span>
            </p>
            <p className="sr-only" aria-live="polite">
              {announcement}
            </p>

            <CardFace
              card={model.cards[pick]!}
              profile={profile}
              pitch={8}
              current
              className="loom-current-card"
              label={`Card ${frame.cardNumber}, ${plural(model.cards[pick]!.punched.filter(Boolean).length, "hole", "holes")} punched`}
            />

            <ol className="card-strip" aria-label="Cards around the current one, in lacing order" onFocus={pause}>
              {strip.map((index) => {
                const card = model.cards[index]!;
                const current = index === pick;
                const holes = card.punched.filter(Boolean).length;
                return (
                  <li key={index}>
                    <button
                      type="button"
                      className="card-strip-item"
                      aria-current={current ? "true" : undefined}
                      aria-label={`Card ${card.number}, ${plural(holes, "hole", "holes")} punched${current ? ", on the loom" : ""}`}
                      onClick={() => seekPick(index, true)}
                    >
                      <CardFace card={card} profile={profile} pitch={4} current={current} showNumber={false} />
                      <span className="card-strip-number mono">{card.number}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      )}
    </Panel>
  );
}
