// Feature: motif-input, Property 14: Editor state
// For any design up to 32 by 32 and any sequence of up to 40 editor actions, every design in the
// state has the original size; a stroke sets exactly the visited cells to the current region and
// leaves all others unchanged; undo after a stroke or replace restores the design before it; redo
// after undo restores the design after it; a new edit clears the redo stack; and the undo stack
// never holds more than 200 entries.
// Validates: Requirements 9.2, 9.3, 9.7, 9.8
//
// Model-based: the reducer is run next to a simple independent model, a list of committed designs
// and a pointer into it, plus the live design while a stroke is open.
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { UNDO_LIMIT, editorReducer, initialEditorState } from "../src/state/editor-state";
import type { EditorAction, EditorState } from "../src/state/editor-state";

const SEED = 1414;
const NUM_RUNS = 100;
const MAX_REGION = 7;

type Grid = number[][];

function deepFreeze(grid: Grid): Grid {
  for (const row of grid) Object.freeze(row);
  return Object.freeze(grid) as Grid;
}

const sizeArb = fc.record({ ends: fc.integer({ min: 1, max: 32 }), picks: fc.integer({ min: 1, max: 32 }) });

function gridArb(ends: number, picks: number): fc.Arbitrary<Grid> {
  return fc.array(fc.array(fc.integer({ min: 0, max: MAX_REGION }), { minLength: ends, maxLength: ends }), {
    minLength: picks,
    maxLength: picks,
  });
}

function actionArb(ends: number, picks: number): fc.Arbitrary<EditorAction> {
  return fc.oneof(
    { weight: 3, arbitrary: fc.constant<EditorAction>({ type: "beginStroke" }) },
    {
      weight: 8,
      // Includes out-of-range cells on every side.
      arbitrary: fc
        .record({ end: fc.integer({ min: -2, max: ends + 1 }), pick: fc.integer({ min: -2, max: picks + 1 }) })
        .map(({ end, pick }): EditorAction => ({ type: "paint", end, pick })),
    },
    { weight: 3, arbitrary: fc.constant<EditorAction>({ type: "endStroke" }) },
    { weight: 2, arbitrary: fc.constant<EditorAction>({ type: "undo" }) },
    { weight: 2, arbitrary: fc.constant<EditorAction>({ type: "redo" }) },
    { weight: 1, arbitrary: gridArb(ends, picks).map((design): EditorAction => ({ type: "replace", design: deepFreeze(design) })) },
    { weight: 2, arbitrary: fc.integer({ min: 0, max: MAX_REGION }).map((region): EditorAction => ({ type: "setRegion", region })) },
  );
}

const scenarioArb = sizeArb.chain(({ ends, picks }) =>
  fc.record({
    ends: fc.constant(ends),
    picks: fc.constant(picks),
    design: gridArb(ends, picks),
    actions: fc.array(actionArb(ends, picks), { maxLength: 40 }),
  }),
);

/** The independent model. */
interface Model {
  history: Grid[];
  index: number;
  live: Grid;
  open: boolean;
  before: Grid;
  region: number;
}

function clone(grid: readonly (readonly number[])[]): Grid {
  return grid.map((row) => [...row]);
}

function equal(a: readonly (readonly number[])[], b: readonly (readonly number[])[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function modelCommit(model: Model, design: Grid): void {
  model.history = [...model.history.slice(0, model.index + 1), design];
  model.index += 1;
  model.live = clone(design);
}

function modelClose(model: Model): void {
  if (!model.open) return;
  model.open = false;
  if (!equal(model.before, model.live)) modelCommit(model, clone(model.live));
  else model.live = clone(model.history[model.index]!);
}

function modelStep(model: Model, action: EditorAction, ends: number, picks: number): void {
  switch (action.type) {
    case "beginStroke":
      modelClose(model);
      model.open = true;
      model.before = clone(model.live);
      return;
    case "paint": {
      const { end, pick } = action;
      if (end < 0 || pick < 0 || end >= ends || pick >= picks) return;
      if (model.open) {
        model.live[pick]![end] = model.region;
        return;
      }
      const next = clone(model.live);
      next[pick]![end] = model.region;
      if (!equal(next, model.live)) modelCommit(model, next);
      return;
    }
    case "endStroke":
      modelClose(model);
      return;
    case "undo":
      modelClose(model);
      if (model.index > 0) {
        model.index -= 1;
        model.live = clone(model.history[model.index]!);
      }
      return;
    case "redo":
      modelClose(model);
      if (model.index < model.history.length - 1) {
        model.index += 1;
        model.live = clone(model.history[model.index]!);
      }
      return;
    case "replace":
      modelClose(model);
      modelCommit(model, clone(action.design));
      return;
    case "setRegion":
      model.region = action.region;
      return;
  }
}

function hasSize(design: readonly (readonly number[])[], ends: number, picks: number): boolean {
  return design.length === picks && design.every((row) => row.length === ends);
}

function allDesigns(state: EditorState): (readonly (readonly number[])[])[] {
  return [state.design, ...state.undo, ...state.redo, ...(state.stroke === null ? [] : [state.stroke.before])];
}

describe("Feature: motif-input, Property 14: Editor state", () => {
  it("matches the history model for any action sequence, keeping the size and the undo cap", () => {
    fc.assert(
      fc.property(scenarioArb, ({ ends, picks, design, actions }) => {
        const frozen = deepFreeze(clone(design));
        let state = initialEditorState(frozen);
        const model: Model = { history: [clone(design)], index: 0, live: clone(design), open: false, before: clone(design), region: 0 };
        for (const action of actions) {
          const previous = state;
          state = editorReducer(state, action);
          modelStep(model, action, ends, picks);
          expect(state.design).toEqual(model.live);
          expect(state.region).toBe(model.region);
          expect(state.stroke !== null).toBe(model.open);
          expect(state.undo.length).toBe(model.index);
          expect(state.redo.length).toBe(model.history.length - 1 - model.index);
          expect(state.undo.length).toBeLessThanOrEqual(UNDO_LIMIT);
          for (const held of allDesigns(state)) expect(hasSize(held, ends, picks)).toBe(true);
          // A committed edit clears redo.
          if (state.undo.length > previous.undo.length && action.type !== "redo") expect(state.redo).toHaveLength(0);
        }
        // The input design was frozen, so any mutation of it would have thrown.
        expect(frozen).toEqual(design);
      }),
      { seed: SEED, numRuns: NUM_RUNS, verbose: 1 },
    );
  });

  it("a stroke sets exactly the visited cells; undo restores before it and redo restores after it", () => {
    const strokeArb = sizeArb.chain(({ ends, picks }) =>
      fc.record({
        ends: fc.constant(ends),
        picks: fc.constant(picks),
        design: gridArb(ends, picks),
        region: fc.integer({ min: 0, max: MAX_REGION }),
        cells: fc.array(fc.record({ end: fc.integer({ min: -1, max: ends }), pick: fc.integer({ min: -1, max: picks }) }), {
          minLength: 1,
          maxLength: 40,
        }),
      }),
    );
    fc.assert(
      fc.property(strokeArb, ({ ends, picks, design, region, cells }) => {
        let state = editorReducer(initialEditorState(deepFreeze(clone(design))), { type: "setRegion", region });
        state = editorReducer(state, { type: "beginStroke" });
        for (const cell of cells) state = editorReducer(state, { type: "paint", ...cell });
        state = editorReducer(state, { type: "endStroke" });
        const visited = new Set(
          cells.filter((c) => c.end >= 0 && c.pick >= 0 && c.end < ends && c.pick < picks).map((c) => `${c.end},${c.pick}`),
        );
        for (let pick = 0; pick < picks; pick += 1) {
          for (let end = 0; end < ends; end += 1) {
            const expected = visited.has(`${end},${pick}`) ? region : design[pick]![end]!;
            expect(state.design[pick]![end]).toBe(expected);
          }
        }
        const after = clone(state.design);
        const changed = !equal(after, design);
        expect(state.undo).toHaveLength(changed ? 1 : 0);
        const undone = editorReducer(state, { type: "undo" });
        expect(undone.design).toEqual(design);
        const redone = editorReducer(undone, { type: "redo" });
        expect(redone.design).toEqual(after);
      }),
      { seed: SEED, numRuns: NUM_RUNS, verbose: 1 },
    );
  });

  it("keeps at most 200 undo entries, dropping the oldest (example, 250 strokes)", () => {
    const ends = 16;
    const picks = 16;
    const start: Grid = Array.from({ length: picks }, () => Array.from({ length: ends }, () => 0));
    let state = editorReducer(initialEditorState(start), { type: "setRegion", region: 1 });
    const snapshots: Grid[] = [clone(start)];
    for (let stroke = 0; stroke < 250; stroke += 1) {
      state = editorReducer(state, { type: "beginStroke" });
      state = editorReducer(state, { type: "paint", end: stroke % ends, pick: Math.floor(stroke / ends) });
      state = editorReducer(state, { type: "endStroke" });
      snapshots.push(clone(state.design));
      expect(state.undo.length).toBe(Math.min(stroke + 1, UNDO_LIMIT));
    }
    expect(UNDO_LIMIT).toBe(200);
    for (let step = 0; step < 200; step += 1) state = editorReducer(state, { type: "undo" });
    // The oldest 50 entries were dropped, so the earliest reachable design is after stroke 50.
    expect(state.design).toEqual(snapshots[50]);
    expect(state.undo).toHaveLength(0);
    const stuck = editorReducer(state, { type: "undo" });
    expect(stuck.design).toEqual(snapshots[50]);
    expect(stuck.redo).toHaveLength(200);
  });
});
