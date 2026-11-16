// The point-paper toolbar (9.3, 9.4): undo and redo (disabled when there is nothing to undo or
// redo), zoom out and in, a cell-size slider, "Fit", the current region and the shortcut list.
import { useId } from "react";
import { MAX_CELL, MIN_CELL } from "./point-paper";
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
}: EditorToolbarProps) {
  const sliderId = useId();
  const mod = IS_MAC ? "Cmd" : "Ctrl";
  return (
    <div className="toolbar" role="group" aria-label="Point paper tools">
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
      <Button small variant="quiet" onClick={onShowShortcuts}>
        Shortcuts
      </Button>
    </div>
  );
}
