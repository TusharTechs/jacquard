// The JACQUARD app: loom setup, motif step, point paper, weaves, the float check, the cloth
// simulator and the exports.
// State lives in editorReducer and setupReducer; every lift plan, float list and fix comes from
// the engine through engine-check.ts (10.6). The check reruns when the design, the weaves or the
// setup change, memoised and deferred so painting stays smooth.
import { useCallback, useDeferredValue, useEffect, useId, useLayoutEffect, useMemo, useReducer, useRef, useState } from "react";
import { checkFloats } from "@jacquard/engine";
import type { Design, Weave, WeaveAssignment } from "@jacquard/engine";
import type { MotifRequest, MotifResponse } from "@jacquard/motif";
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
import { Toast } from "./components/ui/toast";
import type { ToastMessage } from "./components/ui/toast";
import { WeavePanel } from "./components/weave-panel";
import { WEAVE_SLOTS, defaultWeaves } from "./lib/default-weaves";
import { checkDesign, fixDesign } from "./lib/engine-check";
import { sameSource } from "./lib/fix-state";
import type { FixSource, FixState } from "./lib/fix-state";
import { exampleWeaves } from "./lib/gallery";
import type { GalleryExample } from "./lib/gallery";
import { blankDesign, resizeDesign, sizeOf } from "./lib/grid-size";
import type { MotifFailure } from "./lib/motif-client";
import { designFromMotif } from "./lib/motif-design";
import { regionColours } from "./lib/palette";
import { useMotifRequest } from "./lib/use-motif-request";
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

export function App() {
  const [setup, dispatchSetup] = useReducer(setupReducer, DEFAULT_SETUP);
  const [editor, dispatchEditor] = useReducer(editorReducer, DEFAULT_SETUP.repeat, (repeat) => initialEditorState(blankDesign(repeat)));
  const [weaves, setWeaves] = useState<WeaveAssignment>(() => defaultWeaves(WEAVE_SLOTS));
  const [palette, setPalette] = useState<string[] | null>(null);
  const [started, setStarted] = useState(false);
  const [cellSize, setCellSizeRaw] = useState(START_CELL);
  const [fix, setFix] = useState<FixState>({ status: "none" });
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [coarsePointer] = useState(() => mediaMatches("(pointer: coarse)", false));
  const [touchMode, setTouchMode] = useState<TouchMode>(() => (coarsePointer ? "scroll" : "paint"));
  const [regionNumbers, setRegionNumbers] = useState(false);
  const [layer, setLayer] = useState<PaperLayer>("violations");
  // The loom setup is open on wide screens and folded to its summary below 768px.
  const [setupOpen, setSetupOpen] = useState(() => mediaMatches("(min-width: 768px)", true));
  // Yarn colours (2.3). A null weft follows region 0's display colour until the user picks one.
  const [yarnChoice, setYarnChoice] = useState<{ readonly warp: string; readonly weft: string | null }>({ warp: DEFAULT_WARP, weft: null });
  const [motifFocus, setMotifFocus] = useState<{ kind: "text" | "sketch"; id: number } | null>(null);
  const profileRef = useRef<HTMLSelectElement | null>(null);
  const toastId = useRef(0);
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
  const online = useOnline();

  const profile = resolveProfile(setup.profile);
  const design = editor.design;
  const size = sizeOf(design);

  const say = useCallback((text: string, sticky = false) => {
    toastId.current += 1;
    setToast(sticky ? { id: toastId.current, text, sticky } : { id: toastId.current, text });
  }, []);
  const dismissToast = useCallback(() => setToast(null), []);
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
  };

  // ---- Setup changes. A new repeat size resizes the grid as one undoable edit. ----
  const changeSetup = (action: SetupAction): void => {
    const next = setupReducer(setup, action);
    dispatchSetup(action);
    if (next.repeat.ends !== size.ends || next.repeat.picks !== size.picks) {
      if (next.repeat.ends !== setup.repeat.ends || next.repeat.picks !== setup.repeat.picks) {
        dispatchEditor({ type: "replace", design: resizeDesign(design, next.repeat) });
        say(`Grid resized to ${next.repeat.ends} ends by ${next.repeat.picks} picks. Undo brings back the previous grid.`, true);
      }
    }
    if (editor.region >= next.colourCount) dispatchEditor({ type: "setRegion", region: 0 });
  };

  const resizeToRepeat = (): void => {
    dispatchEditor({ type: "replace", design: resizeDesign(design, setup.repeat) });
  };

  const focusGrid = (): void => {
    requestAnimationFrame(() => canvasRef.current?.focus());
  };

  const focusProfile = (): void => {
    setSetupOpen(true);
    requestAnimationFrame(() => {
      profileRef.current?.focus();
      profileRef.current?.scrollIntoView?.({ block: "center" });
    });
  };

  const focusGallery = (): void => {
    const heading = galleryHeadingRef.current;
    if (heading === null) return;
    heading.scrollIntoView?.({ block: "start" });
    heading.focus();
  };

  // ---- Undo and redo. A gallery open also brings back (or re-applies) its setup, palette and weaves. ----
  const applySurroundings = useCallback((wanted: Surroundings, region: number): void => {
    dispatchSetup({ type: "replace", setup: wanted.setup });
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
      { type: "setRepeatAcross", repeatAcross: wanted.repeatAcross },
    ];
    const next = actions.reduce(setupReducer, setup);
    for (const action of actions) dispatchSetup(action);
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
    setLayer("violations");
    requestAnimationFrame(() => viewportRef.current?.scrollIntoView?.({ block: "nearest" }));
    say(`${example.title} is on the grid. Undo brings back the previous grid, loom setup, palette and weaves.`);
  };
  const galleryShown = galleryOpen !== null && editor.undo.length >= galleryOpen.depth ? galleryOpen : null;

  const goToNextViolation = (): void => setNextViolationRequest((value) => value + 1);

  const focusMotif = (kind: "text" | "sketch"): void => {
    setMotifFocus((current) => ({ kind, id: (current?.id ?? 0) + 1 }));
  };

  const startBlank = (): void => {
    setStarted(true);
    if (!(size.ends === setup.repeat.ends && size.picks === setup.repeat.picks && allZero(design))) {
      dispatchEditor({ type: "replace", design: blankDesign(setup.repeat) });
      setGalleryOpen(null);
      say("Blank grid ready. Undo brings back the previous grid.");
    }
    focusGrid();
  };

  // ---- Motif step. ----
  const applyMotif = useCallback(
    (response: MotifResponse, request: MotifRequest): MotifFailure | null => {
      const result = designFromMotif(response.svg, {
        ...setup,
        colourCount: request.colourCount,
        symmetry: request.symmetry,
        repeat: request.repeat,
      });
      if (!result.ok) {
        return {
          kind: "invalidMotif",
          code: result.error.code,
          message: "The suggested motif could not be turned into a design. Try again, or change the description. Your design is unchanged and you can keep editing it by hand.",
        };
      }
      dispatchEditor({ type: "replace", design: result.value.design });
      setGalleryOpen(null);
      setPalette(result.value.palette);
      setStarted(true);
      // Bring the new design into view, as "Start from a blank grid" does (on a phone the point
      // paper sits below the setup and motif panels). Focus stays where it is.
      requestAnimationFrame(() => viewportRef.current?.scrollIntoView?.({ block: "nearest" }));
      say(
        response.source === "standIn"
          ? "Stand-in motif placed on the grid. Edit it freely; Undo brings back the previous grid."
          : "Suggested motif placed on the grid. Edit it freely; Undo brings back the previous grid.",
      );
      return null;
    },
    [setup, say],
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
      if (isTextEntry(event.target) || event.altKey) return;
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
  }, [setup.colourCount, shortcutsOpen, undo, redo]);

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
    const heading = floatHeadingRef.current;
    if (heading === null) return;
    heading.scrollIntoView?.({ block: "start" });
    heading.focus();
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">JACQUARD</h1>
        <div className="holes" aria-hidden="true" />
        <p className="app-lede">
          Punch cards are dead as a computing medium. Handlooms still use them. JACQUARD helps designers and card punchers turn
          a motif into a loom-ready design for a configurable loom profile. The card format has not been tested on a working loom.
        </p>
        <p className="app-sublede">
          Describe or sketch a motif and the model suggests a clean, limited-colour version. You edit every cell on point paper,
          and the weave engine checks the floats as you go.
        </p>
      </header>

      {online ? null : (
        <div className="banner" role="status">
          <strong>You are offline.</strong>
          <span>The editor and the float check keep working. Generating a motif needs the network.</span>
        </div>
      )}

      <main className="layout">
        <div className="column column-side">
          <GalleryPanel onOpen={openExample} openId={galleryShown?.id ?? null} headingRef={galleryHeadingRef} />
          <MotifPanel
            setup={setup}
            online={online}
            request={motif}
            paletteColours={palette === null ? null : regionColours(palette, palette.length)}
            paletteFromGallery={galleryShown !== null}
            onStartBlank={startBlank}
            onOpenGallery={focusGallery}
            focusRequest={motifFocus}
          />
          <LoomSetupPanel
            setup={setup}
            onChange={changeSetup}
            repeatAcrossMessage={repeatAcrossMessage}
            open={setupOpen}
            onOpenChange={setSetupOpen}
            profileRef={profileRef}
          />
        </div>

        <div className="column column-main">
          <Panel
            title="Point paper"
            status={paperStatus}
            empty={
              <>
                <p className="state-title">A blank grid</p>
                <p className="small">
                  Every cell is region <span className="mono">0</span>. Open an example from the gallery, generate a motif
                  to start from, or choose a region and paint with a finger, pen or mouse.
                </p>
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
                <p className="small">A motif is on its way. You can keep painting; the new motif replaces the grid when it arrives, and Undo brings this one back.</p>
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
              onShowShortcuts={() => setShortcutsOpen(true)}
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
                  <Button small variant={shownLayer === "violations" ? "primary" : "secondary"} aria-pressed={shownLayer === "violations"} onClick={() => setLayer("violations")}>
                    Design violations
                  </Button>
                  <Button small variant={shownLayer === "fixes" ? "primary" : "secondary"} aria-pressed={shownLayer === "fixes"} onClick={() => setLayer("fixes")}>
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
                  cell. Press <kbd>N</kbd> on the grid to go to the next one.
                </p>
              ) : null}
            </div>
          </Panel>
        </div>

        <div className="column column-checks">
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
          <ExportPanel
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
        </div>
      </main>

      <Toast message={toast} onDismiss={dismissToast} />
      <Dialog open={shortcutsOpen} title="Point paper shortcuts" onClose={() => setShortcutsOpen(false)}>
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
        </dl>
      </Dialog>
    </div>
  );
}
