// Editor_State: the pure state of the point-paper editor (9.2, 9.3, 9.7, 9.8).
// See .kiro/specs/motif-input/design.md, "Web app".
//
// The design is `design[pick][end]`, as in the engine. A press-drag-release is one stroke: each
// `paint` shows its cell at once, and `endStroke` commits one undo entry holding the design from
// before the stroke, only if the stroke changed a cell. Inputs are never mutated; a new state
// shares unchanged rows with the old one.
import type { Design } from "@jacquard/engine";

/** Undo depth kept by the editor. 9.3 asks for at least 100 [decision: 200]. */
export const UNDO_LIMIT = 200;

export interface Cell {
  readonly end: number;
  readonly pick: number;
}

export interface Stroke {
  /** The design when the stroke began. */
  readonly before: Design;
  /** The in-range cells visited so far, each once, in visiting order. */
  readonly cells: readonly Cell[];
}

export interface EditorState {
  readonly design: Design;
  /** The region that painting sets. */
  readonly region: number;
  /** Earlier designs; the last entry is the most recent. */
  readonly undo: readonly Design[];
  /** Undone designs; the last entry is the next to redo. */
  readonly redo: readonly Design[];
  /** The stroke in progress, or null. */
  readonly stroke: Stroke | null;
}

export type EditorAction =
  | { readonly type: "beginStroke" }
  | { readonly type: "paint"; readonly end: number; readonly pick: number }
  | { readonly type: "endStroke" }
  | { readonly type: "undo" }
  | { readonly type: "redo" }
  | { readonly type: "replace"; readonly design: Design }
  | { readonly type: "setRegion"; readonly region: number };

function copyDesign(design: Design): Design {
  return design.map((row) => [...row]);
}

function sameDesign(a: Design, b: Design): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let pick = 0; pick < a.length; pick += 1) {
    const rowA = a[pick]!;
    const rowB = b[pick]!;
    if (rowA === rowB) continue;
    if (rowA.length !== rowB.length) return false;
    for (let end = 0; end < rowA.length; end += 1) {
      if (rowA[end] !== rowB[end]) return false;
    }
  }
  return true;
}

function pushCapped(stack: readonly Design[], design: Design): Design[] {
  const next = [...stack, design];
  return next.length > UNDO_LIMIT ? next.slice(next.length - UNDO_LIMIT) : next;
}

function inRange(design: Design, end: number, pick: number): boolean {
  if (!Number.isInteger(end) || !Number.isInteger(pick) || pick < 0 || end < 0) return false;
  const row = design[pick];
  return row !== undefined && end < row.length;
}

/** Sets one cell, returning the same design when the cell already has that region. */
function setCell(design: Design, end: number, pick: number, region: number): Design {
  const row = design[pick]!;
  if (row[end] === region) return design;
  const nextRow = [...row];
  nextRow[end] = region;
  const next = [...design];
  next[pick] = nextRow;
  return next;
}

/** Records a committed edit: `before` goes on the undo stack and redo is cleared. */
function commit(state: EditorState, before: Design, design: Design): EditorState {
  return { ...state, design, undo: pushCapped(state.undo, before), redo: [], stroke: null };
}

/** Closes an open stroke, committing it when it changed the design. */
function closeStroke(state: EditorState): EditorState {
  const stroke = state.stroke;
  if (stroke === null) return state;
  if (sameDesign(stroke.before, state.design)) return { ...state, design: stroke.before, stroke: null };
  return commit(state, stroke.before, state.design);
}

export function initialEditorState(design: Design): EditorState {
  return { design: copyDesign(design), region: 0, undo: [], redo: [], stroke: null };
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "beginStroke": {
      const closed = closeStroke(state);
      return { ...closed, stroke: { before: closed.design, cells: [] } };
    }
    case "paint": {
      const { end, pick } = action;
      if (!inRange(state.design, end, pick)) return state;
      const design = setCell(state.design, end, pick, state.region);
      if (state.stroke === null) {
        // A paint outside a stroke (for example Space on the keyboard cursor) is one edit.
        return design === state.design ? state : commit(state, state.design, design);
      }
      const visited = state.stroke.cells.some((cell) => cell.end === end && cell.pick === pick);
      const cells = visited ? state.stroke.cells : [...state.stroke.cells, { end, pick }];
      return { ...state, design, stroke: { before: state.stroke.before, cells } };
    }
    case "endStroke":
      return closeStroke(state);
    case "undo": {
      const closed = closeStroke(state);
      const previous = closed.undo[closed.undo.length - 1];
      if (previous === undefined) return closed;
      return {
        ...closed,
        design: previous,
        undo: closed.undo.slice(0, -1),
        redo: [...closed.redo, closed.design],
      };
    }
    case "redo": {
      const closed = closeStroke(state);
      const next = closed.redo[closed.redo.length - 1];
      if (next === undefined) return closed;
      return {
        ...closed,
        design: next,
        undo: pushCapped(closed.undo, closed.design),
        redo: closed.redo.slice(0, -1),
      };
    }
    case "replace": {
      const closed = closeStroke(state);
      return commit(closed, closed.design, copyDesign(action.design));
    }
    case "setRegion": {
      const { region } = action;
      if (!Number.isInteger(region) || region < 0) return state;
      return { ...state, region };
    }
  }
}
