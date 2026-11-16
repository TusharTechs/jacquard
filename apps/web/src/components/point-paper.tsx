// The point-paper editor (9.1, 9.2, 9.4 to 9.6, 10.2, 10.4). A canvas drawn at the device pixel
// ratio; Pointer Events paint with mouse, pen and touch, one stroke per press-drag-release, with
// every cell between two pointer events filled in; two fingers pinch to change the cell size and
// pan the grid; the keyboard moves a cursor and paints it. All edits go through editorReducer.
// In Scroll mode one finger is left to the browser (scroll and pinch-zoom) and touch never paints;
// mouse and pen still paint.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent, RefObject } from "react";
import type { Design } from "@jacquard/engine";
import { cellLine } from "../lib/cell-line";
import type { GridCell } from "../lib/cell-line";
import { drawPointPaper } from "../lib/draw-point-paper";
import { cellKey, violationStarts } from "../lib/violation-marks";
import type { MarkKind } from "../lib/violation-marks";
import type { EditorAction } from "../state/editor-state";

/** Cell size range from 9.4. */
export const MIN_CELL = 4;
export const MAX_CELL = 32;
/** A touch waits this long for a second finger before it starts painting [decision]. */
const TOUCH_HOLD_MS = 70;
/** A touch that moves this far (CSS px) starts painting at once [decision]. */
const TOUCH_SLOP = 6;

export function clampCell(size: number): number {
  return Math.min(MAX_CELL, Math.max(MIN_CELL, Math.round(size)));
}

/** What one finger does on the grid. */
export type TouchMode = "paint" | "scroll";

type Mode = "idle" | "pending" | "paint" | "pinch" | "settle";

interface Pinch {
  readonly distance: number;
  readonly size: number;
  /** The grid point under the fingers at the start, in cells from the viewport's scroll origin. */
  readonly anchorX: number;
  readonly anchorY: number;
}

export interface PointPaperProps {
  readonly design: Design;
  readonly colours: readonly string[];
  readonly marks: ReadonlyMap<string, MarkKind>;
  readonly errorCell: GridCell | null;
  /** Cells auto-fix flipped, keyed like `marks`; drawn as diamonds. */
  readonly flips?: ReadonlySet<string>;
  readonly regionNumbers?: boolean;
  readonly touchMode?: TouchMode;
  /** True on a coarse (touch) pointer: shows a one-line hint about the touch mode. */
  readonly coarsePointer?: boolean;
  readonly regionCount: number;
  readonly cellSize: number;
  readonly onCellSize: (size: number) => void;
  readonly dispatch: (action: EditorAction) => void;
  readonly viewportRef: RefObject<HTMLDivElement | null>;
  readonly canvasRef: RefObject<HTMLCanvasElement | null>;
  /** Id of a text summary of the grid, linked with aria-describedby. */
  readonly describedBy?: string;
  /**
   * Increases each time another panel asks for the next float violation: the canvas takes focus and
   * the cursor moves as N does.
   */
  readonly nextViolationRequest?: number;
}

function sameCell(a: GridCell | null, b: GridCell | null): boolean {
  return a === b || (a !== null && b !== null && a.end === b.end && a.pick === b.pick);
}

export function PointPaper({
  design,
  colours,
  marks,
  errorCell,
  flips,
  regionNumbers = false,
  touchMode = "paint",
  coarsePointer = false,
  regionCount,
  cellSize,
  onCellSize,
  dispatch,
  viewportRef,
  canvasRef,
  describedBy,
  nextViolationRequest = 0,
}: PointPaperProps) {
  const picks = design.length;
  const ends = design[0]?.length ?? 0;
  const [cursor, setCursorState] = useState<GridCell>({ end: 0, pick: 0 });
  // Mirrors the cursor so several key presses before a render each start from the latest cell.
  const cursorRef = useRef<GridCell>(cursor);
  const setCursor = useCallback((next: GridCell | ((current: GridCell) => GridCell)) => {
    const value = typeof next === "function" ? next(cursorRef.current) : next;
    cursorRef.current = value;
    setCursorState(value);
  }, []);
  const [hover, setHover] = useState<GridCell | null>(null);
  const [focused, setFocused] = useState(false);
  const [keyboard, setKeyboard] = useState(false);
  const [ratio, setRatio] = useState(() => (typeof window === "undefined" ? 1 : window.devicePixelRatio || 1));

  const pointers = useRef(new Map<number, { x: number; y: number; type: string }>());
  const mode = useRef<Mode>("idle");
  const last = useRef<GridCell | null>(null);
  const pending = useRef<{ cell: GridCell; x: number; y: number; timer: ReturnType<typeof setTimeout> | null } | null>(null);
  const pinch = useRef<Pinch | null>(null);
  const scrollTarget = useRef<{ left: number; top: number } | null>(null);

  // Keep the cursor on the grid when the design size changes.
  useEffect(() => {
    setCursor((current) => {
      const end = Math.min(current.end, Math.max(0, ends - 1));
      const pick = Math.min(current.pick, Math.max(0, picks - 1));
      return end === current.end && pick === current.pick ? current : { end, pick };
    });
  }, [ends, picks, setCursor]);

  // Redraw when the pixel ratio changes (zooming the page, moving to another screen).
  useEffect(() => {
    const update = (): void => setRatio(window.devicePixelRatio || 1);
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    drawPointPaper(canvas, {
      design,
      colours,
      cellSize,
      pixelRatio: ratio,
      marks,
      errorCell,
      ...(flips === undefined ? {} : { flips }),
      regionNumbers,
      cursor: focused && keyboard ? cursor : null,
      hover: keyboard ? null : hover,
    });
  }, [canvasRef, design, colours, cellSize, ratio, marks, errorCell, flips, regionNumbers, cursor, focused, keyboard, hover]);

  // After a pinch changes the cell size, scroll so the point under the fingers stays put.
  useLayoutEffect(() => {
    const target = scrollTarget.current;
    const viewport = viewportRef.current;
    if (target === null || viewport === null) return;
    viewport.scrollLeft = target.left;
    viewport.scrollTop = target.top;
    scrollTarget.current = null;
  }, [cellSize, viewportRef]);

  const cellAt = useCallback(
    (clientX: number, clientY: number): GridCell | null => {
      const canvas = canvasRef.current;
      if (canvas === null) return null;
      const box = canvas.getBoundingClientRect();
      const end = Math.floor((clientX - box.left) / cellSize);
      const row = Math.floor((clientY - box.top) / cellSize);
      return { end, pick: picks - 1 - row };
    },
    [canvasRef, cellSize, picks],
  );

  const inGrid = (cell: GridCell | null): cell is GridCell =>
    cell !== null && cell.end >= 0 && cell.end < ends && cell.pick >= 0 && cell.pick < picks;

  const startStroke = (cell: GridCell): void => {
    mode.current = "paint";
    dispatch({ type: "beginStroke" });
    dispatch({ type: "paint", end: cell.end, pick: cell.pick });
    last.current = cell;
    if (inGrid(cell)) setCursor(cell);
  };

  const paintTo = (cell: GridCell): void => {
    const from = last.current ?? cell;
    for (const step of cellLine(from, cell)) {
      if (sameCell(step, from) && last.current !== null) continue;
      dispatch({ type: "paint", end: step.end, pick: step.pick });
    }
    last.current = cell;
    if (inGrid(cell)) setCursor(cell);
  };

  const finishStroke = (): void => {
    if (mode.current === "paint") dispatch({ type: "endStroke" });
    last.current = null;
  };

  const clearPending = (): void => {
    if (pending.current?.timer) clearTimeout(pending.current.timer);
    pending.current = null;
  };

  const beginPinch = (): void => {
    const viewport = viewportRef.current;
    const points = [...pointers.current.values()];
    const a = points[0];
    const b = points[1];
    if (viewport === null || a === undefined || b === undefined) return;
    const box = viewport.getBoundingClientRect();
    const midX = (a.x + b.x) / 2 - box.left;
    const midY = (a.y + b.y) / 2 - box.top;
    pinch.current = {
      distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
      size: cellSize,
      anchorX: (viewport.scrollLeft + midX) / cellSize,
      anchorY: (viewport.scrollTop + midY) / cellSize,
    };
    mode.current = "pinch";
  };

  const movePinch = (): void => {
    const viewport = viewportRef.current;
    const start = pinch.current;
    const points = [...pointers.current.values()];
    const a = points[0];
    const b = points[1];
    if (viewport === null || start === null || a === undefined || b === undefined) return;
    const box = viewport.getBoundingClientRect();
    const midX = (a.x + b.x) / 2 - box.left;
    const midY = (a.y + b.y) / 2 - box.top;
    const size = clampCell((start.size * Math.hypot(a.x - b.x, a.y - b.y)) / start.distance);
    const left = start.anchorX * size - midX;
    const top = start.anchorY * size - midY;
    if (size !== cellSize) {
      scrollTarget.current = { left, top };
      onCellSize(size);
    } else {
      viewport.scrollLeft = left;
      viewport.scrollTop = top;
    }
  };

  const onPointerDown = (event: PointerEvent<HTMLCanvasElement>): void => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    // Scroll mode: the browser scrolls and zooms; a finger never paints.
    if (event.pointerType === "touch" && touchMode === "scroll") return;
    event.preventDefault();
    const canvas = event.currentTarget;
    canvas.focus({ preventScroll: true });
    setKeyboard(false);
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      // Some test environments have no pointer capture; painting still works without it.
    }
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY, type: event.pointerType });
    const touches = [...pointers.current.values()].filter((pointer) => pointer.type === "touch").length;

    if (event.pointerType === "touch" && touches >= 2) {
      // A second finger: stop painting and pinch instead. Cells already painted stay (Undo works).
      clearPending();
      finishStroke();
      beginPinch();
      return;
    }
    if (mode.current !== "idle") return;
    const cell = cellAt(event.clientX, event.clientY);
    if (cell === null) return;
    if (event.pointerType === "touch") {
      mode.current = "pending";
      const timer = setTimeout(() => {
        if (mode.current === "pending" && pending.current !== null) {
          const start = pending.current.cell;
          pending.current = null;
          startStroke(start);
        }
      }, TOUCH_HOLD_MS);
      pending.current = { cell, x: event.clientX, y: event.clientY, timer };
      return;
    }
    startStroke(cell);
  };

  const onPointerMove = (event: PointerEvent<HTMLCanvasElement>): void => {
    if (event.pointerType !== "touch" && mode.current === "idle") {
      const cell = cellAt(event.clientX, event.clientY);
      const next = inGrid(cell) ? cell : null;
      setHover((current) => (sameCell(current, next) ? current : next));
    }
    const tracked = pointers.current.get(event.pointerId);
    if (tracked === undefined) return;
    pointers.current.set(event.pointerId, { ...tracked, x: event.clientX, y: event.clientY });

    if (mode.current === "pinch") {
      movePinch();
      return;
    }
    if (mode.current === "pending" && pending.current !== null) {
      const moved = Math.hypot(event.clientX - pending.current.x, event.clientY - pending.current.y);
      if (moved < TOUCH_SLOP) return;
      const start = pending.current.cell;
      clearPending();
      startStroke(start);
    }
    if (mode.current !== "paint") return;
    const native = event.nativeEvent;
    const samples = typeof native.getCoalescedEvents === "function" ? native.getCoalescedEvents() : [];
    const points = samples.length > 0 ? samples : [native];
    for (const sample of points) {
      const cell = cellAt(sample.clientX, sample.clientY);
      if (cell !== null && !sameCell(cell, last.current)) paintTo(cell);
    }
    if (event.pointerType !== "touch") {
      const cell = cellAt(event.clientX, event.clientY);
      setHover(inGrid(cell) ? cell : null);
    }
  };

  const onPointerEnd = (event: PointerEvent<HTMLCanvasElement>, cancelled: boolean): void => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.delete(event.pointerId);
    if (mode.current === "pending") {
      // A tap: paint the one cell.
      const start = pending.current?.cell ?? null;
      clearPending();
      mode.current = "idle";
      if (!cancelled && start !== null) {
        startStroke(start);
        finishStroke();
        mode.current = "idle";
      }
      return;
    }
    if (mode.current === "paint") {
      finishStroke();
      mode.current = pointers.current.size === 0 ? "idle" : "settle";
      return;
    }
    if (mode.current === "pinch" || mode.current === "settle") {
      // The finger left on the glass after a pinch does not paint until it lifts.
      pinch.current = null;
      mode.current = pointers.current.size === 0 ? "idle" : "settle";
    }
  };

  // Ctrl or Cmd with the wheel (and trackpad pinch, which browsers send as Ctrl+wheel) zooms.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    const onWheel = (event: WheelEvent): void => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      onCellSize(clampCell(cellSize * (event.deltaY < 0 ? 1.15 : 1 / 1.15) + (event.deltaY < 0 ? 0.5 : -0.5)));
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [canvasRef, cellSize, onCellSize]);

  useEffect(() => () => clearPending(), []);

  const scrollIntoView = (cell: GridCell): void => {
    const viewport = viewportRef.current;
    if (viewport === null) return;
    const left = cell.end * cellSize;
    const top = (picks - 1 - cell.pick) * cellSize;
    const margin = cellSize * 2;
    if (left < viewport.scrollLeft + margin) viewport.scrollLeft = Math.max(0, left - margin);
    else if (left + cellSize > viewport.scrollLeft + viewport.clientWidth - margin) viewport.scrollLeft = left + cellSize - viewport.clientWidth + margin;
    if (top < viewport.scrollTop + margin) viewport.scrollTop = Math.max(0, top - margin);
    else if (top + cellSize > viewport.scrollTop + viewport.clientHeight - margin) viewport.scrollTop = top + cellSize - viewport.clientHeight + margin;
  };

  /** The next violation's first cell after `from`, in pick-major order, wrapping; null when there is none. */
  const nextViolation = (from: GridCell): GridCell | null => {
    const starts = violationStarts(marks);
    if (starts.length === 0) return null;
    return starts.find((cell) => cell.pick > from.pick || (cell.pick === from.pick && cell.end > from.end)) ?? starts[0] ?? null;
  };

  // Another panel asked for the next violation ("Go to next violation"): focus and move as N does.
  const handledRequest = useRef(nextViolationRequest);
  useEffect(() => {
    if (nextViolationRequest === handledRequest.current) return;
    handledRequest.current = nextViolationRequest;
    const canvas = canvasRef.current;
    if (canvas === null) return;
    canvas.focus({ preventScroll: true });
    canvas.scrollIntoView?.({ block: "nearest" });
    const next = nextViolation(cursorRef.current);
    if (next === null) return;
    setKeyboard(true);
    setCursor(next);
    scrollIntoView(next);
  });

  const onKeyDown = (event: KeyboardEvent<HTMLCanvasElement>): void => {
    if (event.ctrlKey || event.metaKey || event.altKey) return; // undo, redo and browser keys
    const step = event.shiftKey ? 8 : 1;
    const cursor = cursorRef.current;
    let next: GridCell | null = null;
    switch (event.key) {
      case "ArrowLeft":
        next = { end: Math.max(0, cursor.end - step), pick: cursor.pick };
        break;
      case "ArrowRight":
        next = { end: Math.min(ends - 1, cursor.end + step), pick: cursor.pick };
        break;
      case "ArrowUp":
        next = { end: cursor.end, pick: Math.min(picks - 1, cursor.pick + step) };
        break;
      case "ArrowDown":
        next = { end: cursor.end, pick: Math.max(0, cursor.pick - step) };
        break;
      case "Home":
        next = { end: 0, pick: cursor.pick };
        break;
      case "End":
        next = { end: ends - 1, pick: cursor.pick };
        break;
      case " ":
      case "Enter":
        event.preventDefault();
        setKeyboard(true);
        dispatch({ type: "paint", end: cursor.end, pick: cursor.pick });
        return;
      case "+":
      case "=":
        event.preventDefault();
        onCellSize(clampCell(cellSize + 2));
        return;
      case "-":
      case "_":
        event.preventDefault();
        onCellSize(clampCell(cellSize - 2));
        return;
      case "n":
      case "N": {
        next = nextViolation(cursor);
        if (next === null) return;
        break;
      }
      default:
        return;
    }
    event.preventDefault();
    setKeyboard(true);
    setCursor(next);
    scrollIntoView(next);
  };

  const shown = keyboard && focused ? cursor : (hover ?? (focused ? cursor : null));
  const regionAt = (cell: GridCell): number | undefined => design[cell.pick]?.[cell.end];
  const readout = shown === null ? null : `end ${shown.end} · pick ${shown.pick} · region ${regionAt(shown) ?? "?"}`;
  const inViolation = marks.has(cellKey(cursor.end, cursor.pick));
  const announcement =
    keyboard && focused
      ? `end ${cursor.end}, pick ${cursor.pick}, region ${regionAt(cursor) ?? "unknown"}${inViolation ? ", in a float violation" : ""}`
      : "";
  const keys = Math.min(8, Math.max(1, regionCount));

  return (
    <div>
      <div className="paper-viewport" ref={viewportRef} data-region-keys="">
        <canvas
          ref={canvasRef}
          className="paper-canvas"
          tabIndex={0}
          role="application"
          aria-roledescription="point paper"
          aria-label={`Point paper, ${ends} ends by ${picks} picks. Pick 0 is the bottom row and end 0 the left column. Arrow keys move the cursor, Space or Enter paints it, keys 1 to ${keys} choose the region, N goes to the next float violation.`}
          aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight Space Enter N"
          aria-describedby={describedBy}
          data-touch-mode={touchMode}
          style={{ touchAction: touchMode === "scroll" ? "pan-x pan-y pinch-zoom" : "none" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={(event) => onPointerEnd(event, false)}
          onPointerCancel={(event) => onPointerEnd(event, true)}
          onLostPointerCapture={(event) => onPointerEnd(event, false)}
          onPointerLeave={(event) => {
            if (event.pointerType !== "touch") setHover(null);
          }}
          onContextMenu={(event) => event.preventDefault()}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            setKeyboard(false);
          }}
          onKeyDown={onKeyDown}
          onKeyUp={(event) => {
            if (event.key === "Tab") setKeyboard(true);
          }}
        />
      </div>
      <p className="readout" aria-hidden="true">
        {readout ?? <span className="muted">Point at a cell, or focus the grid and use the arrow keys.</span>}
      </p>
      {coarsePointer ? (
        <p className="small muted touch-hint">
          {touchMode === "scroll"
            ? "Scroll mode: one finger scrolls the grid. Choose Paint in the toolbar to paint with a finger."
            : "Paint mode: one finger paints; two fingers pinch to zoom and drag to scroll."}
        </p>
      ) : null}
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}
