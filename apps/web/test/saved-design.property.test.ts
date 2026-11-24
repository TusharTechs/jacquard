// Feature: motif-builder, Property 4: Saved design round trip
// For any valid Saved_Design (setups within limits, rectangular designs with region indices 0 to 7,
// palettes, weaves from the offered list, Steps, yarns), saving into a fake storage and loading
// returns a deep-equal value; for any stored string that is not a valid Saved_Design, loading
// returns null, removes the key and never throws; a storage whose every call throws gives null and
// "failed" and never throws.
// Validates: Requirements 5.3, 5.4, 5.6
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { WEAVE_CHOICES, WEAVE_SLOTS } from "../src/lib/default-weaves";
import { STEPS } from "../src/lib/route";
import { SAVED_DESIGN_KEY, SAVED_DESIGN_VERSION, loadSavedDesign, saveDesign } from "../src/lib/saved-design";
import type { DesignStorage, SavedDesign } from "../src/lib/saved-design";
import { PROFILE_NAMES, SYMMETRIES, clampSetup } from "../src/state/setup-state";
import type { SetupState } from "../src/state/setup-state";

const SEED = 6104;
const NUM_RUNS = 100;

class MemoryStorage implements DesignStorage {
  readonly items = new Map<string, string>();
  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.items.set(key, value);
  }
  removeItem(key: string): void {
    this.items.delete(key);
  }
}

const throwing: DesignStorage = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("quota");
  },
  removeItem: () => {
    throw new Error("blocked");
  },
};

const hexArb = fc.integer({ min: 0, max: 0xffffff }).map((value) => `#${value.toString(16).padStart(6, "0")}`);

const setupArb: fc.Arbitrary<SetupState> = fc
  .record({
    profile: fc.constantFrom(...PROFILE_NAMES),
    colourCount: fc.integer({ min: 2, max: 8 }),
    ends: fc.integer({ min: 8, max: 400 }),
    picks: fc.integer({ min: 8, max: 400 }),
    minFeature: fc.integer({ min: 1, max: 16 }),
    symmetry: fc.constantFrom(...SYMMETRIES),
    repeatAcross: fc.boolean(),
  })
  .map(({ ends, picks, ...rest }) => clampSetup({ ...rest, repeat: { ends, picks } }));

const savedArb: fc.Arbitrary<SavedDesign> = fc
  .record({
    setup: setupArb,
    ends: fc.integer({ min: 1, max: 40 }),
    picks: fc.integer({ min: 1, max: 40 }),
    palette: fc.option(fc.array(hexArb, { minLength: 1, maxLength: 8 }), { nil: null }),
    weaves: fc.array(fc.constantFrom(...WEAVE_CHOICES.map((choice) => choice.weave)), { minLength: WEAVE_SLOTS, maxLength: WEAVE_SLOTS }),
    warp: hexArb,
    weft: fc.option(hexArb, { nil: null }),
    step: fc.constantFrom(...STEPS),
    seed: fc.array(fc.integer({ min: 0, max: 7 }), { minLength: 1, maxLength: 64 }),
  })
  .map(({ setup, ends, picks, palette, weaves, warp, weft, step, seed }) => ({
    setup,
    design: Array.from({ length: picks }, (_, pick) => Array.from({ length: ends }, (_, end) => seed[(pick * ends + end) % seed.length]!)),
    palette,
    weaves: Object.fromEntries(weaves.map((weave, region) => [region, weave])),
    yarns: { warp, weft },
    step,
  }));

/** Stored strings that are not a valid Saved_Design. */
const badTextArb: fc.Arbitrary<string> = fc.oneof(
  fc.string(),
  fc.json(),
  savedArb.map((saved) => JSON.stringify({ version: SAVED_DESIGN_VERSION + 1, ...saved })),
  savedArb.map((saved) => JSON.stringify({ ...saved })),
  savedArb.map((saved) => JSON.stringify({ version: SAVED_DESIGN_VERSION, ...saved, design: [[8]] })),
  savedArb.map((saved) => JSON.stringify({ version: SAVED_DESIGN_VERSION, ...saved, design: [[0, 1], [0]] })),
  savedArb.map((saved) => JSON.stringify({ version: SAVED_DESIGN_VERSION, ...saved, palette: ["red"] })),
  savedArb.map((saved) => JSON.stringify({ version: SAVED_DESIGN_VERSION, ...saved, setup: { ...saved.setup, profile: "999" } })),
  savedArb.map((saved) => JSON.stringify({ version: SAVED_DESIGN_VERSION, ...saved, setup: { ...saved.setup, colourCount: 99 } })),
  savedArb.map((saved) => JSON.stringify({ version: SAVED_DESIGN_VERSION, ...saved, weaves: { 0: { kind: "lace" } } })),
  savedArb.map((saved) => JSON.stringify({ version: SAVED_DESIGN_VERSION, ...saved, step: "loom" })),
  savedArb.map((saved) => JSON.stringify({ version: SAVED_DESIGN_VERSION, ...saved, yarns: { warp: "#fff", weft: null } })),
  fc.constant("x".repeat(1_000_001)),
);

describe("Feature: motif-builder, Property 4: Saved design round trip", () => {
  it("loads back exactly what was saved", () => {
    fc.assert(
      fc.property(savedArb, (saved) => {
        const storage = new MemoryStorage();
        expect(saveDesign(storage, saved)).toBe("saved");
        expect(loadSavedDesign(storage)).toEqual(saved);
      }),
      { seed: SEED, numRuns: NUM_RUNS, verbose: 1 },
    );
  });

  it("ignores and removes anything that is not a valid saved design", () => {
    fc.assert(
      fc.property(badTextArb, (text) => {
        const storage = new MemoryStorage();
        storage.setItem(SAVED_DESIGN_KEY, text);
        expect(loadSavedDesign(storage)).toBeNull();
        expect(storage.getItem(SAVED_DESIGN_KEY)).toBeNull();
      }),
      { seed: SEED, numRuns: NUM_RUNS, verbose: 1 },
    );
  });

  it("never throws when the storage throws", () => {
    fc.assert(
      fc.property(savedArb, (saved) => {
        expect(loadSavedDesign(throwing)).toBeNull();
        expect(saveDesign(throwing, saved)).toBe("failed");
        expect(loadSavedDesign(null)).toBeNull();
      }),
      { seed: SEED, numRuns: NUM_RUNS, verbose: 1 },
    );
  });
});
