// The point-paper toolbar (9.3, 9.4): undo and redo (disabled when there is nothing to undo or
// redo), zoom out and in, a cell-size slider, "Fit", the current region and the shortcut list.
// Also the touch mode (Paint or Scroll), region numbers, and on narrow screens a compact float
// count with Auto-fix so the check is reachable without scrolling to the float panel.
import { useId } from "react";
import { NUMBERS_FROM } from "../lib/draw-point-paper";
import { MAX_CELL, MIN_CELL } from "./point-paper";
import type { TouchMode } from "./point-paper";
import { Button } from "./ui/button";

export interface EditorToolbarProps {
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly onUndo: () => void;
  readonly onRedo: () => void;
  readonly cellSize: number;
  readonly onCellSize: (size: number) => void;
  readonly onFit: () => void;
  readonly region: number;
  readonly regionColour: string;
  readonly onShowShortcuts: () => void;
  readonly touchMode: TouchMode;
  readonly onTouchMode: (mode: TouchMode) => void;
  readonly regionNumbers: boolean;
  readonly onRegionNumbers: (show: boolean) => void;
  /** Compact float summary for narrow screens; null hides it. */
  readonly floats: { readonly violations: number; readonly fixedFlips: number | null; readonly onAutoFix: () => void } | null;
}

const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

export function EditorToolbar({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  cellSize,
  onCellSize,
  onFit,
  region,
  regionColour,
  onShowShortcuts,
  touchMode,
  onTouchMode,
  regionNumbers,
  onRegionNumbers,
  floats,
}: EditorToolbarProps) {
  const sliderId = useId();
  const numbersId = useId();
  const touchLabelId = useId();
  const mod = IS_MAC ? "Cmd" : "Ctrl";
  return (
    <div className="toolbar" role="group" aria-label="Point paper tools" data-region-keys="">
      <div className="toolbar-group">
        <Button small onClick={onUndo} disabled={!canUndo} title={`Undo (${mod}+Z)`} aria-keyshortcuts={IS_MAC ? "Meta+Z" : "Control+Z"}>
          Undo
        </Button>
        <Button
          small
          onClick={onRedo}
          disabled={!canRedo}
          title={IS_MAC ? "Redo (Cmd+Shift+Z)" : "Redo (Ctrl+Shift+Z or Ctrl+Y)"}
          aria-keyshortcuts={IS_MAC ? "Meta+Shift+Z" : "Control+Shift+Z Control+Y"}
        >
          Redo
        </Button>
      </div>
      <div className="toolbar-zoom">
        <Button small onClick={() => onCellSize(cellSize - 2)} disabled={cellSize <= MIN_CELL}>
          Zoom out
        </Button>
        <label htmlFor={sliderId} className="small">
          Cell size <span className="mono">{cellSize}px</span>
        </label>
        <input
          id={sliderId}
          type="range"
          min={MIN_CELL}
          max={MAX_CELL}
          step={1}
          value={cellSize}
          onChange={(event) => onCellSize(Number(event.target.value))}
        />
        <Button small onClick={() => onCellSize(cellSize + 2)} disabled={cellSize >= MAX_CELL}>
          Zoom in
        </Button>
        <Button small onClick={onFit}>
          Fit
        </Button>
      </div>
      <span className="toolbar-region" aria-live="polite">
        <span className="swatch" style={{ background: regionColour }} aria-hidden="true" />
        Painting region <span className="mono">{region}</span>
      </span>
      <div className="toolbar-group" role="group" aria-labelledby={touchLabelId}>
        <span className="small" id={touchLabelId}>
          One finger:
        </span>
        <Button small variant={touchMode === "paint" ? "primary" : "secondary"} aria-pressed={touchMode === "paint"} onClick={() => onTouchMode("paint")}>
          Paint
        </Button>
        <Button small variant={touchMode === "scroll" ? "primary" : "secondary"} aria-pressed={touchMode === "scroll"} onClick={() => onTouchMode("scroll")}>
          Scroll
        </Button>
      </div>
      <span className="switch-row toolbar-numbers">
        <input id={numbersId} type="checkbox" checked={regionNumbers} onChange={(event) => onRegionNumbers(event.target.checked)} />
        <label htmlFor={numbersId} className="small">
          Show region numbers{regionNumbers && cellSize < NUMBERS_FROM ? ` (from ${NUMBERS_FROM}px cells)` : ""}
        </label>
      </span>
      {floats === null ? null : (
        <span className="toolbar-floats">
          {floats.fixedFlips !== null ? (
            <span className="small">
              Fixed lift plan · <span className="mono">{floats.fixedFlips}</span> flipped
            </span>
          ) : (
            <>
              <span className="small">
                <span className="marker-triangle" aria-hidden="true" /> <span className="mono">{floats.violations}</span>{" "}
                {floats.violations === 1 ? "violation" : "violations"}
              </span>
              <Button small variant="primary" onClick={floats.onAutoFix}>
                Auto-fix
              </Button>
            </>
          )}
        </span>
      )}
      <Button small variant="quiet" onClick={onShowShortcuts}>
        Shortcuts
      </Button>
    </div>
  );
}
