// The JACQUARD Studio (studio-experience Requirement 2): four Steps on a rail, Design, Check,
// Weave and Cards, over the same state as before: loom setup, motif step, point paper, weaves,
// the float check, the cloth simulator, the 3D loom and the exports. Hidden Steps stay mounted.
// State lives in editorReducer and setupReducer; every lift plan, float list and fix comes from
// the engine through engine-check.ts (10.6). The check reruns when the design, the weaves or the
// setup change, memoised and deferred so painting stays smooth.
import type { ReactNode } from "react";
import { useCallback, useDeferredValue, useEffect, useId, useLayoutEffect, useMemo, useReducer, useRef, useState } from "react";
import * as Tooltip from "@radix-ui/react-tooltip";
import { checkFloats } from "@jacquard/engine";
import type { Design, Weave, WeaveAssignment } from "@jacquard/engine";
import type { MotifRequest } from "@jacquard/motif";
import { EditorToolbar } from "./components/editor-toolbar";
import { ExportPanel } from "./components/export-panel";
import { FloatPanel } from "./components/float-panel";
import { GalleryPanel } from "./components/gallery-panel";
import { LoomSetupPanel } from "./components/loom-setup-panel";
import { MotifPanel } from "./components/motif-panel";
import { PointPaper, clampCell } from "./components/point-paper";
import type { TouchMode } from "./components/point-paper";
import { RegionLegend } from "./components/region-legend";
import { SimulatorPanel } from "./components/simulator-panel";
import { Button } from "./components/ui/button";
import { Dialog } from "./components/ui/dialog";
import { Panel } from "./components/ui/panel";
import type { PanelStatus } from "./components/ui/panel";
import { Toaster, notify } from "./components/ui/toaster";
import { StepRail, STEP_LABELS } from "./components/shell/step-rail";
import { StudioMenu } from "./components/shell/studio-menu";
import { TopBar } from "./components/shell/top-bar";
import { setupSummary } from "./components/loom-setup-panel";
import { STEPS, currentStep, parseStep, pushStep, stepHref } from "./lib/route";
import { browserStorage, clearSavedDesign, loadSavedDesign, saveDesign } from "./lib/saved-design";
import type { SavedDesign } from "./lib/saved-design";
import type { Step } from "./lib/route";
import { changeView } from "./lib/view-transition";
import { repeatFits, repeatPolicy } from "./lib/repeat-policy";
import type { RepeatPolicy } from "./lib/repeat-policy";
import { OPENING_EVENT } from "./opening";
import { WeavePanel } from "./components/weave-panel";
import { CardsStep } from "./components/cards/cards-step";
import { WeaveStep, prefetchLoomScene } from "./components/weave/weave-step";
import { WEAVE_SLOTS, defaultWeaves } from "./lib/default-weaves";
import { checkDesign, fixDesign } from "./lib/engine-check";
import { sameSource } from "./lib/fix-state";
import type { FixSource, FixState } from "./lib/fix-state";
import { exampleWeaves } from "./lib/gallery";
import type { GalleryExample } from "./lib/gallery";
import { blankDesign, resizeDesign, sizeOf } from "./lib/grid-size";
import type { MotifFailure } from "./lib/motif-client";
import { localMotifs, prefetchLocalMotifs } from "./lib/motif-client";
import { designFromMotif } from "./lib/motif-design";
import { regionColours } from "./lib/palette";
import { useMotifRequest } from "./lib/use-motif-request";
import type { PlacedMotif } from "./lib/use-motif-request";
import { useOnline } from "./lib/use-online";
import { errorCell, flipCells, violationMarks, violationStarts } from "./lib/violation-marks";
import { DEFAULT_WARP, yarnColours } from "./lib/yarns";
import type { YarnChoice } from "./lib/yarns";
import { UNDO_LIMIT, editorReducer, initialEditorState } from "./state/editor-state";
import { DEFAULT_SETUP, resolveProfile, setupReducer } from "./state/setup-state";
import type { SetupAction, SetupState } from "./state/setup-state";

/** Cell size before the first fit, for environments that report no width [decision]. */
const START_CELL = 8;

function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  if (target instanceof HTMLInputElement) return !["checkbox", "radio", "range", "button", "submit", "file"].includes(target.type);
  return false;
}

/** A media query's current answer, or `fallback` where matchMedia is missing (tests, old browsers). */
function mediaMatches(query: string, fallback: boolean): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return fallback;
  return window.matchMedia(query).matches;
}

/** Shown while a gallery example is on the grid (Phase G review, finding 4). */
export const GALLERY_BADGE = "Gallery example made by the stand-in generator, not a model. Edit it freely.";

/** Digit keys choose a region only when focus is inside an element marked with this attribute. */
const REGION_KEYS_SELECTOR = "[data-region-keys]";

/** What the point paper marks: the design's float violations, or the cells auto-fix flipped. */
type PaperLayer = "violations" | "fixes";

/** The gallery example on the grid, and the undo depth right after it was opened. */
interface GalleryOpen {
  readonly id: string;
  readonly depth: number;
}

/** What opening a gallery example changes besides the grid; Undo and Redo of the open swap it. */
interface Surroundings {
  readonly setup: SetupState;
  readonly palette: string[] | null;
  readonly weaves: WeaveAssignment;
  readonly galleryOpen: GalleryOpen | null;
}

function allZero(design: readonly (readonly number[])[]): boolean {
  return design.every((row) => row.every((cell) => cell === 0));
}

export interface AppProps {
  /**
   * Mount only the current Step at first and the others one by one in idle time, so the first
   * screen is interactive sooner (studio-experience 14.2). A visited Step mounts at once. Off by
   * default, so a render of the App has every panel in the document.
   */
  readonly deferHiddenSteps?: boolean;
  /**
   * Keep the design, setup, palette, weaves, yarns and Step in localStorage across reloads
   * (motif-builder Requirement 5). On only in the real app (main.tsx), so tests share no state.
   */
  readonly persist?: boolean;
}

/** True when the URL names no Step, so a saved Step may be opened. */
function noStepInUrl(): boolean {
  if (typeof window === "undefined") return true;
  const hash = window.location.hash.replace(/^#\/?/, "");
  return hash === "";
}

type IdleHandle = { cancel: () => void };
function whenIdle(run: () => void): IdleHandle {
  const idle = (globalThis as { requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number }).requestIdleCallback;
  if (typeof idle === "function") {
    const handle = idle(run, { timeout: 1500 });
    return { cancel: () => (globalThis as { cancelIdleCallback?: (handle: number) => void }).cancelIdleCallback?.(handle) };
  }
  const timer = setTimeout(run, 200);
  return { cancel: () => clearTimeout(timer) };
}

export function App({ deferHiddenSteps = false, persist = false }: AppProps = {}) {
  // A saved design is read once, before the first render (motif-builder 5.1).
  const [saved] = useState<SavedDesign | null>(() => (persist ? loadSavedDesign(browserStorage()) : null));
  // The first blank grid is an arriving design: repeat across starts on when it fits (17.1).
  const [setup, dispatchSetup] = useReducer(setupReducer, DEFAULT_SETUP, (initial) =>
    saved !== null
      ? saved.setup
      : {
          ...initial,
          repeatAcross: repeatFits(initial.repeat.ends, resolveProfile(initial.profile).hookCount),
        },
  );
  const repeatState = useRef<RepeatPolicy>({ repeatAcross: setup.repeatAcross, chosen: false });
  const [editor, dispatchEditor] = useReducer(editorReducer, DEFAULT_SETUP.repeat, (repeat) =>
    initialEditorState(saved !== null ? saved.design.map((row) => [...row]) : blankDesign(repeat)),
  );
  const [weaves, setWeaves] = useState<WeaveAssignment>(() => (saved !== null ? saved.weaves : defaultWeaves(WEAVE_SLOTS)));
  const [palette, setPalette] = useState<string[] | null>(() => (saved?.palette == null ? null : [...saved.palette]));
  const [started, setStarted] = useState(saved !== null);
  // True while the grid is a design restored from this browser and not yet replaced (5.1).
  const [restored, setRestored] = useState(saved !== null);
  const [cellSize, setCellSizeRaw] = useState(START_CELL);
  const [fix, setFix] = useState<FixState>({ status: "none" });
  // The Step in the URL, or the saved Step when the URL names none (motif-builder 5.1).
  const [initialStep] = useState<Step>(() => (saved !== null && noStepInUrl() ? saved.step : currentStep()));
  const [step, setStep] = useState<Step>(initialStep);
  useEffect(() => {
    if (initialStep === currentStep()) return;
    try {
      window.history.replaceState(null, "", stepHref(initialStep));
    } catch {
      // The Step still shows; only the URL is not updated.
    }
  }, [initialStep]);
  // Steps in the document. All of them unless deferring; then the current one, the others in idle time.
  const [mounted, setMounted] = useState<ReadonlySet<Step>>(() => (deferHiddenSteps ? new Set([initialStep]) : new Set(STEPS)));
  useEffect(() => {
    setMounted((current) => (current.has(step) ? current : new Set([...current, step])));
  }, [step]);
  useEffect(() => {
    if (!deferHiddenSteps) return;
    let handle: IdleHandle | null = null;
    const next = (): void => {
      handle = whenIdle(() => {
        let added = false;
        setMounted((current) => {
          const missing = STEPS.find((item) => !current.has(item));
          if (missing === undefined) return current;
          added = true;
          return new Set([...current, missing]);
        });
        if (added) next();
      });
    };
    next();
    return () => handle?.cancel();
  }, [deferHiddenSteps]);
  const isMounted = (item: Step): boolean => mounted.has(item) || item === step;
  // Increases when a motif or gallery example arrives, so the point paper places it cell by cell.
  const [revealKey, setRevealKey] = useState(0);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [coarsePointer] = useState(() => mediaMatches("(pointer: coarse)", false));
  const [touchMode, setTouchMode] = useState<TouchMode>(() => (coarsePointer ? "scroll" : "paint"));
  const [regionNumbers, setRegionNumbers] = useState(false);
  const [layer, setLayer] = useState<PaperLayer>("violations");
  // The loom setup is open on wide screens and folded to its summary below 768px.
  // The loom setup is a one-line summary with Edit at every width (19.3); Edit opens it.
  const [setupOpen, setSetupOpen] = useState(false);
  // Yarn colours (2.3). A null weft follows region 0's display colour until the user picks one.
  const [yarnChoice, setYarnChoice] = useState<{ readonly warp: string; readonly weft: string | null }>(() => saved?.yarns ?? { warp: DEFAULT_WARP, weft: null });
  const [motifFocus, setMotifFocus] = useState<{ kind: "text" | "sketch"; id: number } | null>(null);
  const profileRef = useRef<HTMLSelectElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const floatHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const galleryHeadingRef = useRef<HTMLHeadingElement | null>(null);
  // The gallery example on the grid, and the undo depth right after it was opened: undoing past
  // that point takes the example off the grid, and the badge with it.
  const [galleryOpen, setGalleryOpen] = useState<GalleryOpen | null>(null);
  // Keyed by the design object a gallery open put on the grid. The editor keeps that object on its
  // undo and redo stacks, so when Undo leaves it the open is being undone (restore `before`), and
  // when Redo brings it back from the top of the redo stack the open is being redone (`after`).
  const galleryEdits = useRef(new WeakMap<Design, { readonly before: Surroundings; readonly after: Surroundings }>());
  const editorRef = useRef(editor);
  editorRef.current = editor;
  // The open waiting for the editor to put its design on the grid (the reducer copies the design,
  // so the key is known only after the render that applies the replace).
  const pendingGalleryEdit = useRef<{ readonly before: Surroundings; readonly after: Surroundings } | null>(null);
  useLayoutEffect(() => {
    const pending = pendingGalleryEdit.current;
    if (pending === null) return;
    pendingGalleryEdit.current = null;
    galleryEdits.current.set(editor.design, pending);
  }, [editor.design]);
  const [nextViolationRequest, setNextViolationRequest] = useState(0);
  const paperSummaryId = useId();
  // The static deploy runs the stand-in in the browser (deploy-static 1.1, 1.6): load it on idle,
  // so generating does not need the network after the first visit.
  const [localMotif] = useState(localMotifs);
  useEffect(() => {
    if (!localMotif) return;
    const handle = whenIdle(prefetchLocalMotifs);
    return () => handle.cancel();
  }, [localMotif]);
  const online = useOnline();

  const profile = resolveProfile(setup.profile);
  const design = editor.design;
  const size = sizeOf(design);

  const say = useCallback(
    (text: string, sticky = false, action?: { readonly label: string; readonly run: () => void }) =>
      notify(text, action === undefined ? { sticky } : { sticky, action }),
    [],
  );

  // ---- Steps (2.3, 2.6): React state, recorded in the URL; Back and Forward read it back. ----
  // Announce Step changes, not the first Step.
  const stepAnnounced = useRef(false);
  useEffect(() => {
    stepAnnounced.current = true;
  }, []);
  const stepRef = useRef(step);
  stepRef.current = step;
  /** Shows `next`, then runs `after` once it is in the DOM (at once when it already shows). */
  const goTo = useCallback((next: Step, after?: () => void): void => {
    if (next === stepRef.current) {
      after?.();
      return;
    }
    stepRef.current = next;
    pushStep(next);
    // A plain Step change starts at the top of the Step; a follow-up scrolls to its own target.
    changeView(() => setStep(next), after ?? (() => window.scrollTo?.({ top: 0 })));
  }, []);
  const menuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const viewTriggerRef = useRef<HTMLButtonElement | null>(null);
  // Where focus goes when the shortcuts dialog closes: the button that opened it (menu or View).
  const shortcutsReturn = useRef<HTMLButtonElement | null>(null);
  const railLinks = useRef(new Map<Step, HTMLAnchorElement>());
  const railLinkRef = useCallback((item: Step, node: HTMLAnchorElement | null): void => {
    if (node === null) railLinks.current.delete(item);
    else railLinks.current.set(item, node);
  }, []);
  useEffect(() => {
    const onPop = (): void => {
      const next = parseStep(window.location.hash);
      if (next === stepRef.current) return;
      stepRef.current = next;
      changeView(() => setStep(next));
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const setCellSize = useCallback((value: number) => setCellSizeRaw(clampCell(value)), []);

  // ---- Engine check (10.1): deferred so a fast stroke is not held up by the engine. ----
  const checkedDesign = useDeferredValue(design);
  const check = useMemo(
    () => checkDesign({ design: checkedDesign, weaves, profile, repeatAcross: setup.repeatAcross }),
    [checkedDesign, weaves, profile, setup.repeatAcross],
  );
  const checking = checkedDesign !== design;
  const checkedSize = sizeOf(checkedDesign);
  const allMarks = useMemo(
    () => violationMarks(check.ok ? check.violations : [], checkedSize.ends, checkedSize.picks),
    [check, checkedSize.ends, checkedSize.picks],
  );
  const badCell = check.ok ? null : errorCell(check.error);
  const repeatAcrossMessage = !check.ok && check.error.code === "REPEAT_NOT_DIVISIBLE" ? check.error.message : null;
  // The repeat-across message sits in the loom setup: open it so the message is seen and heard.
  useEffect(() => {
    if (repeatAcrossMessage !== null) setSetupOpen(true);
  }, [repeatAcrossMessage]);

  // ---- Regions and colours (display only). ----
  const usedRegions = useMemo(() => {
    const seen = new Set<number>();
    for (const row of design) for (const cell of row) seen.add(cell);
    return seen;
  }, [design]);
  const maxUsed = Math.max(-1, ...usedRegions);
  const regionCount = Math.max(setup.colourCount, maxUsed + 1);
  const colours = useMemo(() => regionColours(palette, regionCount), [palette, regionCount]);
  const paintColours = colours.slice(0, setup.colourCount);
  const weaveRegions = useMemo(
    () => Array.from({ length: regionCount }, (_, region) => region).filter((region) => region < setup.colourCount || usedRegions.has(region)),
    [regionCount, setup.colourCount, usedRegions],
  );

  // ---- Auto-fix (10.3): flips lift-plan cells only; the region design is never changed. ----
  const currentSource: FixSource = useMemo(
    () => ({ design, weaves, profile, repeatAcross: setup.repeatAcross }),
    [design, weaves, profile, setup.repeatAcross],
  );
  useEffect(() => {
    setFix((current) =>
      (current.status === "fixed" || current.status === "failed" || current.status === "error") && !sameSource(current.source, currentSource)
        ? { status: "discarded" }
        : current,
    );
  }, [currentSource]);

  const fixed = fix.status === "fixed" ? fix : null;
  const shownLayer: PaperLayer = fixed === null ? "violations" : layer;
  const flips = useMemo(
    () => (fixed === null ? new Set<string>() : flipCells(fixed.flips, size.ends, size.picks)),
    [fixed, size.ends, size.picks],
  );
  const noMarks = useMemo(() => new Map<string, never>(), []);
  const marks = shownLayer === "fixes" ? noMarks : allMarks;

  // ---- Plan for the simulator and the exports (2.4, 6.3): the fixed plan while it is current. ----
  const fixCurrent = fixed !== null && sameSource(fixed.source, currentSource);
  const yarns: YarnChoice = useMemo(
    () => ({ warp: yarnChoice.warp, weft: yarnChoice.weft ?? colours[0] ?? DEFAULT_WARP }),
    [yarnChoice, colours],
  );
  const exportYarns = useMemo(() => yarnColours(yarns), [yarns]);

  const runAutoFix = (): void => {
    if (!check.ok) return;
    const source: FixSource = { design: checkedDesign, weaves, profile, repeatAcross: setup.repeatAcross };
    const fixed = fixDesign(check.plan, profile);
    if (fixed.ok) {
      const after = checkFloats(fixed.plan, profile);
      if (!after.ok) {
        setFix({ status: "error", error: after.error, source });
        return;
      }
      setFix({ status: "fixed", plan: fixed.plan, flips: fixed.flips, remaining: after.value.length, source });
      setLayer("fixes");
      say(`Auto-fix flipped ${fixed.flips.length} lift-plan ${fixed.flips.length === 1 ? "cell" : "cells"}. Your regions are unchanged.`);
      return;
    }
    if (fixed.error.code === "AUTOFIX_FAILED") setFix({ status: "failed", error: fixed.error, source });
    else setFix({ status: "error", error: fixed.error, source });
    // The report is in the float check; from another Step say so, with the way there.
    if (stepRef.current !== "check") {
      say(
        fixed.error.code === "AUTOFIX_FAILED" ? "Auto-fix could not remove every violation." : "Auto-fix stopped with an error.",
        true,
        { label: "Go to the float check", run: () => goToFloatCheckRef.current() },
      );
    }
  };

  // ---- Setup changes. A new repeat size resizes the grid as one undoable edit. ----
  const changeSetup = (action: SetupAction): void => {
    let next = setupReducer(setup, action);
    dispatchSetup(action);
    // Repeat across follows the design until the user chooses (17.1). If the setup was put back by
    // Undo or Redo since the policy last ran, it is the user's: keep it.
    const before =
      repeatState.current.repeatAcross === setup.repeatAcross ? repeatState.current : { repeatAcross: setup.repeatAcross, chosen: true };
    repeatState.current =
      action.type === "setRepeatAcross"
        ? repeatPolicy(before, { type: "choose", repeatAcross: action.repeatAcross })
        : action.type === "setProfile" || action.type === "setRepeatEnds"
          ? repeatPolicy(before, { type: "reshape", ends: next.repeat.ends, hookCount: resolveProfile(next.profile).hookCount })
          : before;
    if (repeatState.current.repeatAcross !== next.repeatAcross) {
      next = { ...next, repeatAcross: repeatState.current.repeatAcross };
      dispatchSetup({ type: "setRepeatAcross", repeatAcross: next.repeatAcross });
    }
    if (next.repeat.ends !== size.ends || next.repeat.picks !== size.picks) {
      if (next.repeat.ends !== setup.repeat.ends || next.repeat.picks !== setup.repeat.picks) {
        dispatchEditor({ type: "replace", design: resizeDesign(design, next.repeat) });
        say(`Grid resized to ${next.repeat.ends} ends by ${next.repeat.picks} picks. Undo brings back the previous grid.`, true, {
          label: "Undo",
          run: () => undoRef.current(),
        });
      }
    }
    if (editor.region >= next.colourCount) dispatchEditor({ type: "setRegion", region: 0 });
  };

  const resizeToRepeat = (): void => {
    dispatchEditor({ type: "replace", design: resizeDesign(design, setup.repeat) });
  };

  const focusGrid = (): void => {
    if (stepRef.current !== "check") goTo("design");
    requestAnimationFrame(() => canvasRef.current?.focus());
  };

  const focusProfile = (): void => {
    setSetupOpen(true);
    goTo("design", () =>
      requestAnimationFrame(() => {
        profileRef.current?.focus();
        profileRef.current?.scrollIntoView?.({ block: "center" });
      }),
    );
  };

  const focusGallery = (): void => {
    goTo("design", () => {
      const heading = galleryHeadingRef.current;
      if (heading === null) return;
      heading.scrollIntoView?.({ block: "start" });
      heading.focus();
    });
  };

  // ---- Undo and redo. A gallery open also brings back (or re-applies) its setup, palette and weaves. ----
  const applySurroundings = useCallback((wanted: Surroundings, region: number): void => {
    dispatchSetup({ type: "replace", setup: wanted.setup });
    repeatState.current = { repeatAcross: wanted.setup.repeatAcross, chosen: true };
    setPalette(wanted.palette === null ? null : [...wanted.palette]);
    setWeaves(wanted.weaves);
    setGalleryOpen(wanted.galleryOpen);
    if (region >= wanted.setup.colourCount) dispatchEditor({ type: "setRegion", region: 0 });
  }, []);
  const undo = useCallback((): void => {
    const current = editorReducer(editorRef.current, { type: "endStroke" });
    const edit = current.undo.length > 0 ? galleryEdits.current.get(current.design) : undefined;
    dispatchEditor({ type: "undo" });
    editorRef.current = editorReducer(editorRef.current, { type: "undo" });
    if (edit !== undefined) applySurroundings(edit.before, current.region);
  }, [applySurroundings]);
  const undoRef = useRef(undo);
  undoRef.current = undo;
  const redo = useCallback((): void => {
    const current = editorReducer(editorRef.current, { type: "endStroke" });
    const next = current.redo[current.redo.length - 1];
    const edit = next === undefined ? undefined : galleryEdits.current.get(next);
    dispatchEditor({ type: "redo" });
    editorRef.current = editorReducer(editorRef.current, { type: "redo" });
    if (edit !== undefined) applySurroundings(edit.after, current.region);
  }, [applySurroundings]);

  // ---- Gallery: one undoable grid edit, plus the example's setup, palette and weaves. ----
  const openExample = (example: GalleryExample): void => {
    const { setup: wanted } = example;
    const actions: SetupAction[] = [
      { type: "setProfile", profile: wanted.profile },
      { type: "setColourCount", colourCount: wanted.colourCount },
      { type: "setRepeatEnds", ends: wanted.repeat.ends },
      { type: "setRepeatPicks", picks: wanted.repeat.picks },
      { type: "setMinFeature", minFeature: wanted.minFeature },
      { type: "setSymmetry", symmetry: wanted.symmetry },
      // Repeat across follows the example's width (17.1), whatever the file says.
      { type: "setRepeatAcross", repeatAcross: repeatFits(wanted.repeat.ends, resolveProfile(wanted.profile).hookCount) },
    ];
    const next = actions.reduce(setupReducer, setup);
    for (const action of actions) dispatchSetup(action);
    // An example arrives with its own setup; the user has not chosen repeat for it yet.
    repeatState.current = { repeatAcross: next.repeatAcross, chosen: false };
    // The motif panel's label and state belong to the last motif request, not to this example.
    motif.reset();
    const before = editorReducer(editorRef.current, { type: "endStroke" });
    const after = editorReducer(before, { type: "replace", design: example.design });
    dispatchEditor({ type: "replace", design: example.design });
    if (editor.region >= next.colourCount) dispatchEditor({ type: "setRegion", region: 0 });
    const opened: Surroundings = {
      setup: next,
      palette: [...example.palette],
      weaves: exampleWeaves(example),
      galleryOpen: { id: example.id, depth: Math.min(after.undo.length, UNDO_LIMIT) },
    };
    pendingGalleryEdit.current = { before: { setup, palette, weaves, galleryOpen }, after: opened };
    setPalette(opened.palette === null ? null : [...opened.palette]);
    setWeaves(opened.weaves);
    setGalleryOpen(opened.galleryOpen);
    setStarted(true);
    setRestored(false);
    setLayer("violations");
    setRevealKey((value) => value + 1);
    requestAnimationFrame(() => viewportRef.current?.scrollIntoView?.({ block: "nearest" }));
    say(`${example.title} is on the grid. Undo brings back the previous grid, loom setup, palette and weaves.`);
  };
  const galleryShown = galleryOpen !== null && editor.undo.length >= galleryOpen.depth ? galleryOpen : null;

  const goToNextViolation = (): void => setNextViolationRequest((value) => value + 1);

  const focusMotif = (kind: "text" | "sketch"): void => {
    goTo("design", () => setMotifFocus((current) => ({ kind, id: (current?.id ?? 0) + 1 })));
  };

  /** A design arrives: repeat across turns on exactly when its width fits the hooks (17.1). */
  const arrive = (ends: number, profileName: SetupState["profile"], current: boolean): void => {
    repeatState.current = repeatPolicy(repeatState.current, { type: "arrive", ends, hookCount: resolveProfile(profileName).hookCount });
    if (repeatState.current.repeatAcross !== current) dispatchSetup({ type: "setRepeatAcross", repeatAcross: repeatState.current.repeatAcross });
  };
  const arriveRef = useRef(arrive);
  arriveRef.current = arrive;

  const startBlank = (): void => {
    // Start from a blank grid also forgets the saved design (motif-builder 5.5), and the motif
    // panel's label no longer describes the grid.
    if (persist) clearSavedDesign(browserStorage());
    setRestored(false);
    motif.reset();
    setStarted(true);
    arrive(setup.repeat.ends, setup.profile, setup.repeatAcross);
    if (!(size.ends === setup.repeat.ends && size.picks === setup.repeat.picks && allZero(design))) {
      dispatchEditor({ type: "replace", design: blankDesign(setup.repeat) });
      setGalleryOpen(null);
      say("Blank grid ready. Undo brings back the previous grid.");
    }
    focusGrid();
  };

  // ---- Saving (motif-builder 5.1, 5.5): 400 ms after the last change and when the page is hidden.
  // An all-blank grid is not saved: there is nothing to bring back.
  const saveNow = useRef<() => void>(() => undefined);
  // Said once per visit when the browser will not keep the design.
  const saveWarned = useRef(false);
  saveNow.current = () => {
    const storage = browserStorage();
    if (allZero(design)) {
      clearSavedDesign(storage);
      return;
    }
    const outcome = saveDesign(storage, { design, setup, palette, weaves, yarns: yarnChoice, step });
    if (outcome !== "saved" && !saveWarned.current) {
      saveWarned.current = true;
      say("This design is not saved in this browser (storage is full or blocked). Export a WIF file to keep it.");
    }
  };
  useEffect(() => {
    if (!persist) return;
    const timer = setTimeout(() => saveNow.current(), 400);
    return () => clearTimeout(timer);
  }, [persist, design, setup, palette, weaves, yarnChoice, step]);
  useEffect(() => {
    if (!persist) return;
    const onHide = (): void => saveNow.current();
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [persist]);

  // ---- Motif step. ----
  const applyMotif = useCallback(
    (response: PlacedMotif, request: MotifRequest): MotifFailure | null => {
      // A builder motif brings its own symmetry and colours (motif-builder 3.5).
      const plan = response.plan;
      const symmetry = plan?.symmetry ?? request.symmetry;
      const colourCount = plan === undefined ? request.colourCount : Math.max(setup.colourCount, request.colourCount, response.palette.length);
      const result = designFromMotif(response.svg, {
        ...setup,
        colourCount,
        symmetry,
        repeat: request.repeat,
      });
      if (!result.ok) {
        return {
          kind: "invalidMotif",
          code: result.error.code,
          message:
            response.source === "builder"
              ? "The motif builder's drawing does not fit this loom setup. Change a chip, the description or the repeat. Your design is unchanged and you can keep editing it by hand."
              : "The suggested motif could not be turned into a design. Try again, or change the description. Your design is unchanged and you can keep editing it by hand.",
        };
      }
      dispatchEditor({ type: "replace", design: result.value.design });
      arriveRef.current(result.value.design[0]?.length ?? request.repeat.ends, setup.profile, setup.repeatAcross);
      if (plan !== undefined) {
        // The loom setup shows what the builder used; Undo brings back grid, setup and palette
        // together, as for a gallery example.
        const nextSetup: SetupState = { ...setup, colourCount, symmetry, repeatAcross: repeatState.current.repeatAcross };
        pendingGalleryEdit.current = {
          before: { setup, palette, weaves, galleryOpen },
          after: { setup: nextSetup, palette: [...result.value.palette], weaves, galleryOpen: null },
        };
        dispatchSetup({ type: "replace", setup: nextSetup });
        repeatState.current = { ...repeatState.current, repeatAcross: nextSetup.repeatAcross };
      }
      setRevealKey((value) => value + 1);
      setGalleryOpen(null);
      setPalette(result.value.palette);
      setStarted(true);
      setRestored(false);
      // Bring the new design into view, as "Start from a blank grid" does (on a phone the point
      // paper sits below the setup and motif panels). Focus stays where it is.
      requestAnimationFrame(() => viewportRef.current?.scrollIntoView?.({ block: "nearest" }));
      say(
        response.source === "builder"
          ? "Motif built from your description and placed on the grid. Edit it freely; Undo brings back the previous grid and loom setup."
          : response.source === "standIn"
            ? localMotif
              ? "Pattern placed on the grid. Edit it freely; Undo brings back the previous grid."
              : "Stand-in motif placed on the grid. Edit it freely; Undo brings back the previous grid."
            : "Suggested motif placed on the grid. Edit it freely; Undo brings back the previous grid.",
      );
      return null;
    },
    [setup, say, palette, weaves, galleryOpen, localMotif],
  );
  const motif = useMotifRequest(applyMotif);

  // ---- Offline (12.4). ----
  const wasOnline = useRef(online);
  useEffect(() => {
    if (online && !wasOnline.current) say("Back online. You can generate a motif again.");
    wasOnline.current = online;
  }, [online, say]);

  // ---- Fit the repeat to the container width (9.4); runs on first render and for new widths. ----
  const fit = useCallback(() => {
    const viewport = viewportRef.current;
    if (viewport === null || viewport.clientWidth === 0 || size.ends === 0) return;
    setCellSize(Math.floor((viewport.clientWidth - 2) / size.ends));
  }, [setCellSize, size.ends]);
  useLayoutEffect(() => {
    fit();
  }, [fit]);

  // ---- Editor shortcuts from anywhere except text entry (9.3, 9.5). ----
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (isTextEntry(event.target)) return;
      // Alt+1 to Alt+4 choose the Steps (2.9). By code, because Option+digit types a symbol on a Mac.
      if (event.altKey) {
        const match = /^Digit([1-4])$/.exec(event.code);
        if (match !== null && !event.ctrlKey && !event.metaKey) {
          if (document.querySelector("dialog[open]") !== null) return;
          const target = STEPS[Number(match[1]) - 1];
          if (target !== undefined) {
            event.preventDefault();
            goTo(target, () => {
              // Focus that was inside the Step just hidden goes to the new Step's rail link.
              const active = document.activeElement;
              if (active === null || active === document.body || (active instanceof HTMLElement && active.closest("[hidden]") !== null)) {
                railLinks.current.get(target)?.focus();
              }
              window.scrollTo?.({ top: 0 });
            });
          }
        }
        return;
      }
      const mod = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      if (mod && key === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && key === "y" && event.ctrlKey) {
        event.preventDefault();
        redo();
        return;
      }
      if (!mod && !event.shiftKey && /^[1-8]$/.test(event.key)) {
        // Only on the point paper, its toolbar or the region legend, and never under a dialog.
        if (shortcutsOpen || document.querySelector("dialog[open]") !== null) return;
        if (!(event.target instanceof Element) || event.target.closest(REGION_KEYS_SELECTOR) === null) return;
        const region = Number(event.key) - 1;
        if (region < setup.colourCount) {
          event.preventDefault();
          dispatchEditor({ type: "setRegion", region });
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setup.colourCount, shortcutsOpen, undo, redo, goTo]);

  const changeWeave = (region: number, weave: Weave): void => setWeaves((current) => ({ ...current, [region]: weave }));

  // ---- Point paper states (12.1). ----
  let paperStatus: PanelStatus = "ready";
  if (motif.state.status === "loading") paperStatus = "loading";
  else if (!check.ok) paperStatus = "error";
  else if (!started && editor.undo.length === 0 && allZero(design)) paperStatus = "empty";
  const sizeMismatch = size.ends !== setup.repeat.ends || size.picks !== setup.repeat.picks;
  const blankStart = paperStatus === "empty" || size.ends === 0 || size.picks === 0;
  const planInUse = blankStart ? null : fixCurrent ? fixed.plan : check.ok ? check.plan : null;
  const planSource = fixCurrent ? "fixed" : "design";

  // One polite live region for the simulator and the exports: it speaks only when the plan they
  // use switches between the fixed plan and the design's plan, not on every render.
  const [planAnnouncement, setPlanAnnouncement] = useState("");
  const lastPlanSource = useRef(planSource);
  useEffect(() => {
    if (planSource === lastPlanSource.current) return;
    lastPlanSource.current = planSource;
    setPlanAnnouncement(
      planSource === "fixed"
        ? "The cloth simulation and the exports now use the fixed lift plan from auto-fix."
        : "The cloth simulation and the exports now use the lift plan of the current design.",
    );
  }, [planSource]);

  // ---- Text summary of the point paper for screen readers (Phase G review, finding 11). ----
  const paperSummary = useMemo(() => {
    const counts = new Map<number, number>();
    for (const row of design) for (const cell of row) counts.set(cell, (counts.get(cell) ?? 0) + 1);
    const regions = [...counts.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([region, count]) => `region ${region}: ${count} ${count === 1 ? "cell" : "cells"}`)
      .join(", ");
    let floats: string;
    if (!check.ok) floats = "The float check could not run on this design.";
    else if (check.violations.length === 0) floats = "No float violations.";
    else {
      const first = violationStarts(allMarks)[0];
      const count = check.violations.length;
      floats = `${count} float ${count === 1 ? "violation" : "violations"}${first === undefined ? "" : `; the first starts at end ${first.end}, pick ${first.pick}`}.`;
    }
    return `Grid of ${size.ends} ends by ${size.picks} picks. Cells per region: ${regions === "" ? "none" : regions}. ${floats} For a full text version of the grid, use the Point paper (SVG) export.`;
  }, [design, check, allMarks, size.ends, size.picks]);

  const goToFloatCheck = (): void => {
    goTo("check", () => {
      const heading = floatHeadingRef.current;
      if (heading === null) return;
      heading.scrollIntoView?.({ block: "start" });
      heading.focus();
    });
  };
  const goToFloatCheckRef = useRef(goToFloatCheck);
  goToFloatCheckRef.current = goToFloatCheck;

  // ---- Step rail (2.2, 3.2): a short status per Step and the one primary action. ----
  const stepCount = planInUse === null ? null : planInUse.pickCount;
  const railStatus: Record<Step, ReactNode> = {
    design: <span className="mono">{size.ends}×{size.picks}</span>,
    check:
      paperStatus === "empty" ? (
        "—"
      ) : !check.ok ? (
        "Error"
      ) : fixed !== null ? (
        <>
          <span className="marker-ok" aria-hidden="true" /> Fixed
        </>
      ) : check.violations.length > 0 ? (
        <>
          <span className="marker-triangle" aria-hidden="true" /> <span className="mono">{check.violations.length}</span>
        </>
      ) : (
        <>
          <span className="marker-ok" aria-hidden="true" /> OK
        </>
      ),
    weave: stepCount === null ? "—" : <span className="mono">{stepCount} picks</span>,
    cards: stepCount === null ? "—" : <span className="mono">{stepCount} cards</span>,
  };
  const railStatusText: Record<Step, string> = {
    design: `${size.ends} by ${size.picks}`,
    check:
      paperStatus === "empty"
        ? "nothing to check yet"
        : !check.ok
          ? "the check could not run"
          : fixed !== null
            ? "fixed by auto-fix"
            : check.violations.length > 0
              ? `${check.violations.length} float ${check.violations.length === 1 ? "violation" : "violations"}`
              : "no long floats",
    weave: stepCount === null ? "no lift plan yet" : `${stepCount} picks`,
    cards: stepCount === null ? "no cards yet" : `${stepCount} cards`,
  };
  const nextStep = STEPS[STEPS.indexOf(step) + 1];
  const stepAnnouncement = stepAnnounced.current ? `${STEP_LABELS[step]} step` : "";
  // Continue is the Step's primary action unless the Step has a more pressing one: a start action on
  // an empty grid, or Auto-fix while violations stand (one primary per Step, 3.1, 3.2).
  const violationsOpen = check.ok && check.violations.length > 0 && fixed === null;
  const continuePrimary = !(paperStatus === "empty" || planInUse === null || ((step === "design" || step === "check") && violationsOpen));
  const railNext =
    nextStep === undefined
      ? null
      : {
          label: `Continue to ${STEP_LABELS[nextStep]}`,
          step: nextStep,
          primary: continuePrimary,
          // The Continue button leaves on the last Step, so focus goes to the Step's own action.
          run: () =>
            goTo(
              nextStep,
              nextStep === "cards"
                ? () => {
                    window.scrollTo?.({ top: 0 });
                    requestAnimationFrame(() => {
                      const target =
                        document.querySelector<HTMLElement>(".area-cards .panel-actions button") ??
                        railLinks.current.get("cards") ??
                        null;
                      target?.focus();
                    });
                  }
                : undefined,
            ),
        };

  return (
    <Tooltip.Provider delayDuration={300}>
    <div className="studio" data-step={step}>
      <TopBar
        setupSummary={setupSummary(setup)}
        onOpenSetup={focusProfile}
        menu={
          <StudioMenu
            triggerRef={menuTriggerRef}
            onShortcuts={() => {
              shortcutsReturn.current = menuTriggerRef.current;
              setShortcutsOpen(true);
            }} onOpening={() => window.dispatchEvent(new CustomEvent(OPENING_EVENT))} />
        }
      />
      <StepRail step={step} status={railStatus} statusText={railStatusText} onSelect={(next) => goTo(next)} next={railNext} linkRef={railLinkRef} onPrefetch={(item) => {
          if (item === "weave") prefetchLoomScene();
        }} />
      <p className="sr-only" aria-live="polite">
        {stepAnnouncement}
      </p>

      {online ? null : (
        <div className="banner" role="status">
          <strong>You are offline.</strong>
          <span>
            {localMotif
              ? "The editor, the float check and the motif builder keep working."
              : "The editor and the float check keep working. Generating a motif needs the network."}
          </span>
        </div>
      )}

      <main className="studio-stage" data-step={step}>
        <section aria-label="Design: start" className="area area-start" hidden={step !== "design"}>
          {isMounted("design") ? (
            <>
          <GalleryPanel onOpen={openExample} openId={galleryShown?.id ?? null} headingRef={galleryHeadingRef} />
          <MotifPanel
            setup={setup}
            online={online || localMotif}
            localStandIn={localMotif}
            request={motif}
            paletteColours={palette === null ? null : regionColours(palette, palette.length)}
            paletteFromGallery={galleryShown !== null}
            onStartBlank={startBlank}
            onOpenGallery={focusGallery}
            focusRequest={motifFocus}
            restored={restored}
          />
            </>
          ) : null}
        </section>

        <section aria-label="Design: loom setup" className="area area-setup" hidden={step !== "design"}>
          {isMounted("design") ? (
            <>
          <LoomSetupPanel
            setup={setup}
            onChange={changeSetup}
            repeatAcrossMessage={repeatAcrossMessage}
            open={setupOpen}
            onOpenChange={setSetupOpen}
            profileRef={profileRef}
          />
            </>
          ) : null}
        </section>

        <div className="area area-bench" hidden={step !== "design" && step !== "check"}>
          <Panel
            title="Point paper"
            status={paperStatus}
            empty={
              <>
                <p className="state-title">A blank grid</p>
                <p className="small">Start from an example, a motif, or paint.</p>
                <div className="state-actions">
                  <Button small variant="primary" onClick={focusGallery}>
                    Open a gallery example
                  </Button>
                  <Button small onClick={() => focusMotif("text")}>
                    Describe a motif
                  </Button>
                  <Button small onClick={() => focusMotif("sketch")}>
                    Upload a sketch
                  </Button>
                </div>
              </>
            }
            loading={
              <>
                <p className="small">A motif is on its way. Keep painting; Undo brings this grid back.</p>
                <div className="progress" aria-hidden="true" />
                <div className="state-actions">
                  <Button small onClick={motif.cancel}>
                    Cancel
                  </Button>
                </div>
              </>
            }
            error={
              !check.ok ? (
                <>
                  <p className="small">
                    The float check stopped: {check.error.message}
                    {badCell === null ? "" : " The cell is marked with a cross."} See the float check for what to do next.
                  </p>
                  <div className="state-actions">
                    <Button small onClick={goToFloatCheck}>
                      Go to the float check
                    </Button>
                  </div>
                </>
              ) : undefined
            }
          >
            <EditorToolbar
              canUndo={editor.undo.length > 0}
              canRedo={editor.redo.length > 0}
              onUndo={undo}
              onRedo={redo}
              cellSize={cellSize}
              onCellSize={setCellSize}
              onFit={fit}
              region={editor.region}
              regionColour={colours[editor.region] ?? "transparent"}
              onShowShortcuts={() => {
                shortcutsReturn.current = viewTriggerRef.current;
                setShortcutsOpen(true);
              }}
              viewTriggerRef={viewTriggerRef}
              touchMode={touchMode}
              onTouchMode={setTouchMode}
              regionNumbers={regionNumbers}
              onRegionNumbers={setRegionNumbers}
              floats={
                check.ok && paperStatus !== "empty" && (fixed !== null || check.violations.length > 0)
                  ? { violations: check.violations.length, fixedFlips: fixed === null ? null : fixed.flips.length, onAutoFix: runAutoFix }
                  : null
              }
            />
            <div className="stack">
              {galleryShown === null ? null : <p className="label-suggestion">{GALLERY_BADGE}</p>}
              <RegionLegend colours={paintColours} region={editor.region} onChange={(region) => dispatchEditor({ type: "setRegion", region })} />
              {sizeMismatch ? (
                <div className="note" role="status">
                  <p>
                    The grid is <span className="mono">{size.ends}</span> by <span className="mono">{size.picks}</span>; the loom
                    setup repeat is <span className="mono">{setup.repeat.ends}</span> by <span className="mono">{setup.repeat.picks}</span>.
                  </p>
                  <Button small onClick={resizeToRepeat}>
                    Resize grid to the repeat
                  </Button>
                </div>
              ) : null}
              {fixed === null ? null : (
                <div className="toolbar-group" role="group" aria-label="Show on the point paper">
                  <span className="small">Show:</span>
                  <Button small aria-pressed={shownLayer === "violations"} onClick={() => setLayer("violations")}>
                    Design violations
                  </Button>
                  <Button small aria-pressed={shownLayer === "fixes"} onClick={() => setLayer("fixes")}>
                    Auto-fix changes
                  </Button>
                </div>
              )}
              <PointPaper
                design={design}
                colours={colours}
                marks={marks}
                errorCell={badCell}
                flips={shownLayer === "fixes" ? flips : undefined}
                regionNumbers={regionNumbers}
                touchMode={touchMode}
                coarsePointer={coarsePointer}
                regionCount={setup.colourCount}
                cellSize={cellSize}
                onCellSize={setCellSize}
                dispatch={dispatchEditor}
                viewportRef={viewportRef}
                canvasRef={canvasRef}
                describedBy={paperSummaryId}
                nextViolationRequest={nextViolationRequest}
                revealKey={revealKey}
                active={step === "design" || step === "check"}
              />
              <p className="sr-only" id={paperSummaryId}>
                {paperSummary}
              </p>
              {shownLayer === "fixes" ? (
                <p className="small paper-legend">
                  <span className="marker-diamond" aria-hidden="true" /> Diamond: a lift-plan cell auto-fix flipped (
                  <span className="mono">{flips.size}</span> on this repeat). Your regions are unchanged.
                </p>
              ) : allMarks.size > 0 ? (
                <p className="small paper-legend">
                  <span className="marker-triangle" aria-hidden="true" /> Outline: a float over the limit; triangle: its first
                  cell. <kbd>N</kbd>: next.
                </p>
              ) : null}
            </div>
          </Panel>
        </div>

        <section aria-label="Check" className="area area-checks" hidden={step !== "check"}>
          {isMounted("check") ? (
            <>
          <FloatPanel
            check={size.ends === 0 || size.picks === 0 || paperStatus === "empty" ? null : check}
            checking={checking}
            profile={profile}
            fix={fix}
            canUndo={editor.undo.length > 0}
            onAutoFix={runAutoFix}
            onUndo={undo}
            onNextViolation={goToNextViolation}
            onTurnOffRepeatAcross={() => changeSetup({ type: "setRepeatAcross", repeatAcross: false })}
            onChooseProfile={focusProfile}
            headingRef={floatHeadingRef}
          />
          <SimulatorPanel
            plan={planInUse}
            planSource={planSource}
            profile={profile}
            yarns={yarns}
            onYarnsChange={(next) => setYarnChoice({ warp: next.warp, weft: next.weft })}
            onResetYarns={() => setYarnChoice({ warp: DEFAULT_WARP, weft: null })}
            emptyReason={blankStart ? "blank" : "engineError"}
            onGoToFloatCheck={goToFloatCheck}
          />
          <p className="sr-only" role="status" aria-live="polite">
            {planAnnouncement}
          </p>
          <WeavePanel
            regions={weaveRegions}
            colours={colours}
            weaves={weaves}
            warnings={check.ok ? check.warnings : []}
            onChange={changeWeave}
          />
            </>
          ) : null}
        </section>

        <section aria-label="Weave" className="area area-weave" hidden={step !== "weave"}>
          {isMounted("weave") ? (
            <>
          <WeaveStep
            plan={planInUse}
            planSource={planSource}
            profile={profile}
            yarns={exportYarns}
            violationCount={check.ok ? check.violations.length : 0}
            visible={step === "weave"}
            emptyReason={blankStart ? "blank" : "engineError"}
            onGoToFloatCheck={goToFloatCheck}
            onOpenGallery={focusGallery}
          />
            </>
          ) : null}
        </section>

        <section aria-label="Cards" className="area area-cards" hidden={step !== "cards"}>
          {isMounted("cards") ? (
            <>
          <CardsStep
            plan={planInUse}
            profile={profile}
            profileName={setup.profile}
            blank={blankStart}
            onOpenGallery={focusGallery}
            onGoToDesign={() => goTo("design")}
            onGoToFloatCheck={goToFloatCheck}
            planSource={planSource}
            violationCount={check.ok ? check.violations.length : 0}
            checking={checking}
            onAutoFix={runAutoFix}
            visible={step === "cards"}
          />
          <ExportPanel
            lead={false}
            profileName={setup.profile}
            profile={profile}
            plan={planInUse}
            planSource={planSource}
            design={design}
            colours={colours}
            yarns={exportYarns}
            violationCount={check.ok ? check.violations.length : 0}
            checking={checking}
            blank={blankStart}
            onAutoFix={runAutoFix}
          />
            </>
          ) : null}
        </section>
      </main>

      <Toaster />
      <Dialog open={shortcutsOpen} title="Point paper shortcuts" onClose={() => setShortcutsOpen(false)} fallbackFocus={shortcutsReturn}>
        <dl className="shortcut-list">
          <dt>
            <kbd>←</kbd> <kbd>→</kbd> <kbd>↑</kbd> <kbd>↓</kbd>
          </dt>
          <dd>Move the cursor one cell; with <kbd>Shift</kbd>, eight cells. Up is towards higher picks.</dd>
          <dt>
            <kbd>Space</kbd> or <kbd>Enter</kbd>
          </dt>
          <dd>Paint the cursor cell with the current region.</dd>
          <dt>
            <kbd>N</kbd>
          </dt>
          <dd>Move the cursor to the next float violation.</dd>
          <dt>
            <kbd>1</kbd> to <kbd>{Math.min(8, setup.colourCount)}</kbd>
          </dt>
          <dd>Choose region 0 to {Math.min(8, setup.colourCount) - 1}.</dd>
          <dt>
            <kbd>Ctrl</kbd>/<kbd>Cmd</kbd> + <kbd>Z</kbd>
          </dt>
          <dd>Undo.</dd>
          <dt>
            <kbd>Ctrl</kbd>/<kbd>Cmd</kbd> + <kbd>Shift</kbd> + <kbd>Z</kbd>, <kbd>Ctrl</kbd> + <kbd>Y</kbd>
          </dt>
          <dd>Redo.</dd>
          <dt>
            <kbd>+</kbd> <kbd>−</kbd>
          </dt>
          <dd>Larger or smaller cells. Two fingers pinch to zoom and drag to scroll on touch screens.</dd>
          <dt>
            <kbd>Alt</kbd> + <kbd>1</kbd> to <kbd>4</kbd>
          </dt>
          <dd>Go to Design, Check, Weave or Cards.</dd>
        </dl>
      </Dialog>
    </div>
    </Tooltip.Provider>
  );
}
