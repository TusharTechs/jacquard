// The point-paper toolbar (9.3, 9.4; studio-experience 19.1): Undo, Redo, Fit and the current
// region stay in view; a "View" popover holds the secondary controls: zoom out and in, the cell-size
// slider, the one-finger mode (Paint or Scroll), region numbers and the shortcut list. On narrow
// screens a compact float count with Auto-fix keeps the check reachable.
import * as Popover from "@radix-ui/react-popover";
import { Eye } from "lucide-react";
import { useId, useRef, useState } from "react";
import type { RefObject } from "react";
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
  /** Set to the View button, so a dialog opened from the popover can return focus to it. */
  readonly viewTriggerRef?: RefObject<HTMLButtonElement | null>;
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
  viewTriggerRef,
}: EditorToolbarProps) {
  const sliderId = useId();
  const numbersId = useId();
  const touchLabelId = useId();
  const mod = IS_MAC ? "Cmd" : "Ctrl";
  const [viewOpen, setViewOpen] = useState(false);
  // Opening the shortcuts dialog from the popover: the dialog takes focus, not the popover's trigger.
  const handingOff = useRef(false);
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
      <Button small onClick={onFit}>
        Fit
      </Button>
      <span className="toolbar-region" aria-live="polite">
        <span className="swatch" style={{ background: regionColour }} aria-hidden="true" />
        Painting region <span className="mono">{region}</span>
      </span>
      {/* Not portalled: the popover hides with its Step, so a Step change never leaves it floating. */}
      <Popover.Root open={viewOpen} onOpenChange={setViewOpen}>
        <Popover.Trigger asChild>
          <Button small className="view-trigger" ref={viewTriggerRef}>
            <Eye aria-hidden="true" size={16} />
            {/* Scroll mode is shown on the button, so a touch user sees why one finger scrolls. */}
            {touchMode === "scroll" ? "View · Scroll" : "View"}
          </Button>
        </Popover.Trigger>
          <Popover.Content
            onCloseAutoFocus={(event) => {
              if (handingOff.current) {
                handingOff.current = false;
                event.preventDefault();
              }
            }} className="view-popover" align="start" sideOffset={6} collisionPadding={8} aria-label="View" data-region-keys="">
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
            </div>
            <div className="toolbar-group" role="group" aria-labelledby={touchLabelId}>
              <span className="small" id={touchLabelId}>
                One finger:
              </span>
              <Button small aria-pressed={touchMode === "paint"} onClick={() => onTouchMode("paint")}>
                Paint
              </Button>
              <Button small aria-pressed={touchMode === "scroll"} onClick={() => onTouchMode("scroll")}>
                Scroll
              </Button>
            </div>
            <span className="switch-row toolbar-numbers">
              <input id={numbersId} type="checkbox" checked={regionNumbers} onChange={(event) => onRegionNumbers(event.target.checked)} />
              <label htmlFor={numbersId} className="small switch-label">
                Show region numbers{regionNumbers && cellSize < NUMBERS_FROM ? ` (from ${NUMBERS_FROM}px cells)` : ""}
              </label>
            </span>
            <Button
              small
              variant="quiet"
              onClick={() => {
                // The popover closes and the dialog opens; on close the dialog returns focus to View.
                handingOff.current = true;
                setViewOpen(false);
                onShowShortcuts();
              }}
            >
              Shortcuts
            </Button>
          </Popover.Content>
      </Popover.Root>
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
    </div>
  );
}
