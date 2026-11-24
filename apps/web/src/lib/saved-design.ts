// The design kept across reloads (motif-builder Requirement 5): the grid, loom setup, palette,
// weaves, yarns and Step in localStorage under one versioned key. Undo history is not kept. Every
// storage call is in try/catch, so a missing, full or blocked storage never breaks the app, and a
// stored value that does not pass validation is removed instead of being trusted.
import { validateWeave } from "@jacquard/engine";
import type { Weave, WeaveAssignment } from "@jacquard/engine";
import { DEFAULT_SETUP, setupReducer } from "../state/setup-state";
import type { SetupState } from "../state/setup-state";
import { defaultWeaves, WEAVE_SLOTS } from "./default-weaves";
import { isStep } from "./route";
import type { Step } from "./route";

export const SAVED_DESIGN_KEY = "jacquard.design";
export const SAVED_DESIGN_VERSION = 1;
/** Longest JSON text written [decision]; a 240 by 400 design is about 200,000 characters. */
export const SAVED_DESIGN_LIMIT = 1_000_000;

export interface SavedDesign {
  readonly design: readonly (readonly number[])[];
  readonly setup: SetupState;
  readonly palette: readonly string[] | null;
  readonly weaves: WeaveAssignment;
  readonly yarns: { readonly warp: string; readonly weft: string | null };
  readonly step: Step;
}

/** The part of Storage this module uses, so tests can pass a fake. */
export type DesignStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type SaveOutcome = "saved" | "tooLarge" | "failed";

const HEX = /^#[0-9a-f]{6}$/;

/** The browser's localStorage, or null when it cannot be reached (blocked cookies, no window). */
export function browserStorage(): DesignStorage | null {
  try {
    const storage = typeof window === "undefined" ? undefined : window.localStorage;
    return storage ?? null;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sameSetup(a: SetupState, b: SetupState): boolean {
  return (
    a.profile === b.profile &&
    a.colourCount === b.colourCount &&
    a.repeat.ends === b.repeat.ends &&
    a.repeat.picks === b.repeat.picks &&
    a.minFeature === b.minFeature &&
    a.symmetry === b.symmetry &&
    a.repeatAcross === b.repeatAcross
  );
}

function readSetup(value: unknown): SetupState | null {
  if (!isRecord(value) || !isRecord(value["repeat"])) return null;
  const repeat = value["repeat"];
  const candidate = {
    profile: value["profile"],
    colourCount: value["colourCount"],
    repeat: { ends: repeat["ends"], picks: repeat["picks"] },
    minFeature: value["minFeature"],
    symmetry: value["symmetry"],
    repeatAcross: value["repeatAcross"],
  } as unknown as SetupState;
  if (typeof candidate.repeatAcross !== "boolean") return null;
  for (const field of [candidate.colourCount, candidate.repeat.ends, candidate.repeat.picks, candidate.minFeature]) {
    if (typeof field !== "number" || !Number.isInteger(field)) return null;
  }
  // The reducer rejects unknown profiles and symmetries and clamps numbers; a stored setup must
  // already be what the reducer gives back.
  const checked = setupReducer(DEFAULT_SETUP, { type: "replace", setup: candidate });
  if (checked === DEFAULT_SETUP) return null; // unknown profile or symmetry
  return sameSetup(checked, candidate) ? checked : null;
}

/** Largest grid side kept (the most picks a repeat may have) [decision]. */
const MAX_SIDE = 400;

/**
 * A rectangular grid of at most 400 by 400 with region indices 0 to 7. Its size is not tied to the
 * setup's repeat, because the grid may differ from it (after Undo of a resize) as in the app.
 */
function readDesign(value: unknown): number[][] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_SIDE) return null;
  const ends = Array.isArray(value[0]) ? (value[0] as unknown[]).length : 0;
  if (ends === 0 || ends > MAX_SIDE) return null;
  const design: number[][] = [];
  for (const row of value) {
    if (!Array.isArray(row) || row.length !== ends) return null;
    for (const cell of row) {
      if (typeof cell !== "number" || !Number.isInteger(cell) || cell < 0 || cell >= WEAVE_SLOTS) return null;
    }
    design.push([...(row as number[])]);
  }
  return design;
}

function readPalette(value: unknown): string[] | null | undefined {
  if (value === null) return null;
  if (!Array.isArray(value) || value.length === 0 || value.length > WEAVE_SLOTS) return undefined;
  for (const colour of value) if (typeof colour !== "string" || !HEX.test(colour)) return undefined;
  return [...(value as string[])];
}

function readWeaves(value: unknown): WeaveAssignment | null {
  if (!isRecord(value)) return null;
  const weaves: Record<number, Weave> = { ...defaultWeaves(WEAVE_SLOTS) };
  for (const [key, weave] of Object.entries(value)) {
    const region = Number(key);
    if (!/^[0-7]$/.test(key)) return null;
    const checked = validateWeave(region, weave);
    if (!checked.ok) return null;
    weaves[region] = checked.value;
  }
  return weaves;
}

function readYarns(value: unknown): SavedDesign["yarns"] | null {
  if (!isRecord(value)) return null;
  const { warp, weft } = value;
  if (typeof warp !== "string" || !HEX.test(warp)) return null;
  if (weft !== null && (typeof weft !== "string" || !HEX.test(weft))) return null;
  return { warp, weft };
}

/** Checks a parsed value; null when anything is off. */
export function readSavedDesign(value: unknown): SavedDesign | null {
  if (!isRecord(value) || value["version"] !== SAVED_DESIGN_VERSION) return null;
  const setup = readSetup(value["setup"]);
  if (setup === null) return null;
  const design = readDesign(value["design"]);
  if (design === null) return null;
  const palette = readPalette(value["palette"]);
  if (palette === undefined) return null;
  const weaves = readWeaves(value["weaves"]);
  if (weaves === null) return null;
  const yarns = readYarns(value["yarns"]);
  if (yarns === null) return null;
  const step = value["step"];
  if (typeof step !== "string" || !isStep(step)) return null;
  return { design, setup, palette, weaves, yarns, step };
}

/** Removes the saved design; never throws. */
export function clearSavedDesign(storage: DesignStorage | null): void {
  if (storage === null) return;
  try {
    storage.removeItem(SAVED_DESIGN_KEY);
  } catch {
    // Blocked storage: nothing to clear.
  }
}

/** The saved design, or null. A stored value that fails validation is removed (5.4). */
export function loadSavedDesign(storage: DesignStorage | null): SavedDesign | null {
  if (storage === null) return null;
  let text: string | null;
  try {
    text = storage.getItem(SAVED_DESIGN_KEY);
  } catch {
    return null;
  }
  if (text === null) return null;
  let saved: SavedDesign | null = null;
  if (text.length <= SAVED_DESIGN_LIMIT) {
    try {
      saved = readSavedDesign(JSON.parse(text));
    } catch {
      saved = null;
    }
  }
  if (saved === null) clearSavedDesign(storage);
  return saved;
}

/** Writes the design; a value over the limit is not written and the old one is removed (5.4). */
export function saveDesign(storage: DesignStorage | null, saved: SavedDesign): SaveOutcome {
  if (storage === null) return "failed";
  let text: string;
  try {
    text = JSON.stringify({ version: SAVED_DESIGN_VERSION, ...saved });
  } catch {
    return "failed";
  }
  if (text.length > SAVED_DESIGN_LIMIT) {
    clearSavedDesign(storage);
    return "tooLarge";
  }
  try {
    storage.setItem(SAVED_DESIGN_KEY, text);
    return "saved";
  } catch {
    return "failed";
  }
}
