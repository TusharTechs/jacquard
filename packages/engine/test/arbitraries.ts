// fast-check generators for the weave-engine property tests.
// See design.md, "Testing Strategy", Generators. This file imports only types from `src`, so the
// generators do not depend on the code under test.
//
// Not yet included: a lift-plan generator "built from a design". It needs `buildLiftPlan`
// (task 7.1). `liftPlanArb` below builds random plans directly and is biased toward long runs.

import * as fc from "fast-check";

import type { EngineErrorCode } from "../src/errors.js";
import type { Design, LiftPlan, LoomProfile, Weave, WeaveAssignment } from "../src/types.js";

/** Throws when a value is missing. Only for states that the generators make impossible. */
function must<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`arbitraries: missing ${what}`);
  return value;
}

// ---------------------------------------------------------------------------------------------
// Weaves (1.6). The satin move table is a separate copy, so the generator stays independent of
// the engine's own table.
// ---------------------------------------------------------------------------------------------

const SATIN_MOVES = { 5: [2, 3], 8: [3, 5] } as const;

export type PlainWeave = Extract<Weave, { kind: "plain" }>;
export type TwillWeave = Extract<Weave, { kind: "twill" }>;
export type SatinWeave = Extract<Weave, { kind: "satin" }>;

export const plainArb: fc.Arbitrary<PlainWeave> = fc.constant<PlainWeave>({ kind: "plain" });

export const twillArb: fc.Arbitrary<TwillWeave> = fc.record({
  kind: fc.constant("twill" as const),
  up: fc.integer({ min: 1, max: 5 }),
  down: fc.integer({ min: 1, max: 5 }),
  direction: fc.constantFrom("S" as const, "Z" as const),
});

export const satinArb: fc.Arbitrary<SatinWeave> = fc
  .constantFrom(5 as const, 8 as const)
  .chain((size) =>
    fc.record({
      kind: fc.constant("satin" as const),
      size: fc.constant(size),
      move: fc.constantFrom(...SATIN_MOVES[size]),
      facing: fc.constantFrom("warp" as const, "weft" as const),
    }),
  );

/** Any valid weave: plain, twill (up and down 1 to 5), or satin with an allowed move. */
export const weaveArb: fc.Arbitrary<Weave> = fc.oneof(plainArb, twillArb, satinArb);

/** A weave for every region index 0 to regionCount - 1. */
export function weaveAssignmentArb(regionCount: number): fc.Arbitrary<WeaveAssignment> {
  return fc.array(weaveArb, { minLength: regionCount, maxLength: regionCount }).map((weaves) => {
    const assignment: Record<number, Weave> = {};
    weaves.forEach((weave, region) => {
      assignment[region] = weave;
    });
    return assignment;
  });
}

// ---------------------------------------------------------------------------------------------
// Loom profiles (1.2). hookCount 1 to 48 keeps cases small; the built-in profiles are covered by
// example tests.
// ---------------------------------------------------------------------------------------------

export function profileArb(minHooks = 1, maxHooks = 48): fc.Arbitrary<LoomProfile> {
  return fc.record({
    hookCount: fc.integer({ min: minHooks, max: maxHooks }),
    hooksPerCardRow: fc.integer({ min: 1, max: 12 }),
    spareHookCount: fc.integer({ min: 0, max: 20 }),
    spareHookPlacement: fc.constant("afterFiguring" as const),
    maxFloat: fc.integer({ min: 1, max: 10 }),
    maxWarpFloat: fc.integer({ min: 1, max: 10 }),
    maxWeftFloat: fc.integer({ min: 1, max: 10 }),
    regionLimit: fc.integer({ min: 1, max: 8 }),
    holeMeans: fc.constantFrom("lift" as const, "noLift" as const),
    cardFillOrder: fc.constant("ascending" as const),
    wovenFaceDown: fc.boolean(),
  });
}

// ---------------------------------------------------------------------------------------------
// Valid inputs (1.1, 2.5)
// ---------------------------------------------------------------------------------------------

export interface ValidInput {
  readonly design: Design;
  readonly weaves: WeaveAssignment;
  readonly profile: LoomProfile;
  readonly repeatAcross: boolean;
}

export interface ValidInputOptions {
  readonly minHooks?: number;
  readonly maxHooks?: number;
  /** When false, repeatAcross is always false. Default true. */
  readonly allowRepeat?: boolean;
}

function divisorsOf(n: number): number[] {
  const divisors: number[] = [];
  for (let d = 1; d <= n; d += 1) {
    if (n % d === 0) divisors.push(d);
  }
  return divisors;
}

/**
 * A valid design, weave assignment and profile. Design: 1 to 24 picks, width 1 to hookCount,
 * region indices below regionLimit. With repeatAcross on, the width divides hookCount ("repeat-ready").
 */
export function validInputArb(options: ValidInputOptions = {}): fc.Arbitrary<ValidInput> {
  const { minHooks = 1, maxHooks = 48, allowRepeat = true } = options;
  return profileArb(minHooks, maxHooks).chain((profile) =>
    fc.boolean().chain((wantRepeat) => {
      const repeatAcross = allowRepeat && wantRepeat;
      const widthArb = repeatAcross
        ? fc.constantFrom(...divisorsOf(profile.hookCount))
        : fc.integer({ min: 1, max: profile.hookCount });
      return fc
        .tuple(widthArb, fc.integer({ min: 1, max: 24 }))
        .chain(([width, pickCount]) =>
          fc
            .tuple(
              fc.array(
                fc.array(fc.integer({ min: 0, max: profile.regionLimit - 1 }), {
                  minLength: width,
                  maxLength: width,
                }),
                { minLength: pickCount, maxLength: pickCount },
              ),
              weaveAssignmentArb(profile.regionLimit),
            )
            .map(([design, weaves]) => ({ design, weaves, profile, repeatAcross })),
        );
    }),
  );
}

// ---------------------------------------------------------------------------------------------
// Lift plans, biased toward long runs so floats and unbound lines are common (design, Generators)
// ---------------------------------------------------------------------------------------------

type PatternKind = "solid" | "vstripes" | "hstripes" | "blocks" | "noise";

interface PatternParams {
  readonly kind: PatternKind;
  readonly a: number;
  readonly b: number;
  readonly invert: boolean;
  readonly noise: readonly boolean[];
  readonly flips: readonly (readonly [number, number])[];
}

const patternArb: fc.Arbitrary<PatternParams> = fc.record({
  kind: fc.constantFrom<PatternKind>("solid", "vstripes", "hstripes", "blocks", "noise"),
  a: fc.integer({ min: 1, max: 12 }),
  b: fc.integer({ min: 1, max: 12 }),
  invert: fc.boolean(),
  noise: fc.array(fc.boolean(), { minLength: 1, maxLength: 64 }),
  flips: fc.array(fc.tuple(fc.nat(), fc.nat()), { maxLength: 4 }),
});

function patternUnit(pickCount: number, width: number, params: PatternParams): boolean[][] {
  const unit: boolean[][] = [];
  for (let pick = 0; pick < pickCount; pick += 1) {
    const row: boolean[] = [];
    for (let end = 0; end < width; end += 1) {
      let lifted: boolean;
      switch (params.kind) {
        case "solid":
          lifted = false;
          break;
        case "vstripes":
          lifted = Math.floor(end / params.a) % 2 === 1;
          break;
        case "hstripes":
          lifted = Math.floor(pick / params.a) % 2 === 1;
          break;
        case "blocks":
          lifted = (Math.floor(end / params.a) + Math.floor(pick / params.b)) % 2 === 1;
          break;
        case "noise":
          lifted = must(params.noise[(pick * width + end) % params.noise.length], "noise bit");
          break;
      }
      row.push(lifted !== params.invert);
    }
    unit.push(row);
  }
  for (const [flipPick, flipEnd] of params.flips) {
    const row = must(unit[flipPick % pickCount], "unit row");
    const end = flipEnd % width;
    row[end] = !must(row[end], "unit cell");
  }
  return unit;
}

export interface PlanCase {
  readonly profile: LoomProfile;
  readonly repeatAcross: boolean;
  readonly plan: LiftPlan;
}

/**
 * A valid lift plan with its profile. Idle hooks are unlifted, and with repeatAcross on the unit is
 * tiled over every hook, so `plan` passes the checks in 2.13.
 */
export function liftPlanArb(options: ValidInputOptions = {}): fc.Arbitrary<PlanCase> {
  const { minHooks = 1, maxHooks = 48, allowRepeat = true } = options;
  return profileArb(minHooks, maxHooks).chain((profile) =>
    fc.boolean().chain((wantRepeat) => {
      const repeatAcross = allowRepeat && wantRepeat;
      const widthArb = repeatAcross
        ? fc.constantFrom(...divisorsOf(profile.hookCount))
        : fc.integer({ min: 1, max: profile.hookCount });
      return fc
        .tuple(widthArb, fc.integer({ min: 1, max: 24 }), patternArb)
        .map(([width, pickCount, params]) => {
          const unit = patternUnit(pickCount, width, params);
          const lifts = unit.map((row) =>
            Array.from({ length: profile.hookCount }, (_, hook) =>
              hook < width
                ? must(row[hook], "unit cell")
                : repeatAcross
                  ? must(row[hook % width], "unit cell")
                  : false,
            ),
          );
          const plan: LiftPlan = {
            pickCount,
            hookCount: profile.hookCount,
            designWidth: width,
            repeatAcross,
            lifts,
          };
          return { profile, repeatAcross, plan };
        });
    }),
  );
}

// ---------------------------------------------------------------------------------------------
// Fault injectors for Property 16 and 17 (3.7). One injector per validation step. Each guarantees
// its fault. Faults are applied from the last step of 3.7 to the first, so a later injector never
// overwrites an earlier fault; the expected error is that of the earliest injected fault.
// ---------------------------------------------------------------------------------------------

/** An input that may break the rules. Cast it to the engine's input type in the test. */
export interface FaultyInput {
  readonly design: readonly (readonly unknown[])[];
  readonly weaves: Readonly<Record<number, unknown>>;
  readonly profile: Readonly<Record<string, unknown>>;
  readonly repeatAcross: boolean;
}

export function toFaulty(input: ValidInput): FaultyInput {
  return {
    design: input.design.map((row) => [...row]),
    weaves: { ...input.weaves },
    profile: { ...input.profile },
    repeatAcross: input.repeatAcross,
  };
}

/** A valid starting input for fault injection: hookCount at least 3, so every fault is possible. */
export const faultBaseArb: fc.Arbitrary<FaultyInput> = validInputArb({
  minHooks: 3,
  allowRepeat: false,
}).map(toFaulty);

/** The validation steps of 3.7, in the order the engine must report them. */
export const FAULT_ORDER = [
  "profile",
  "weaveParameters",
  "emptyDesign",
  "unequalRows",
  "invalidCell",
  "tooWide",
  "repeatNotDivisible",
  "tooManyRegions",
  "missingWeave",
] as const;

export type FaultKind = (typeof FAULT_ORDER)[number];

export const FAULT_CODE: Readonly<Record<FaultKind, EngineErrorCode>> = {
  profile: "PROFILE_INVALID",
  weaveParameters: "WEAVE_INVALID",
  emptyDesign: "DESIGN_EMPTY",
  unequalRows: "DESIGN_ROWS_UNEQUAL",
  invalidCell: "DESIGN_CELL_INVALID",
  tooWide: "DESIGN_TOO_WIDE",
  repeatNotDivisible: "REPEAT_NOT_DIVISIBLE",
  tooManyRegions: "TOO_MANY_REGIONS",
  missingWeave: "WEAVE_MISSING",
};

/**
 * The error the engine must return when this fault is the earliest. `fields` names every field of
 * the error except `code` and `message`. Compare values with Object.is: an injected NaN equals NaN.
 */
export interface ExpectedError {
  readonly code: EngineErrorCode;
  readonly fields: Readonly<Record<string, unknown>>;
}

export interface Injection {
  readonly input: FaultyInput;
  readonly expected: ExpectedError;
}

function numberField(record: Readonly<Record<string, unknown>>, field: string): number {
  const value = record[field];
  if (typeof value !== "number") throw new Error(`arbitraries: ${field} is not a number`);
  return value;
}

function copyRows(input: FaultyInput): unknown[][] {
  return input.design.map((row) => [...row]);
}

function resizeRows(rows: readonly (readonly unknown[])[], width: number): unknown[][] {
  return rows.map((row) => Array.from({ length: width }, (_, end) => row[end] ?? 0));
}

const PROFILE_FAULTS: readonly (readonly [string, unknown])[] = [
  ["hookCount", 0],
  ["hooksPerCardRow", -1],
  ["spareHookCount", -1],
  ["spareHookPlacement", "beforeFiguring"],
  ["maxFloat", 1.5],
  ["maxWarpFloat", 0],
  ["maxWeftFloat", Number.NaN],
  ["regionLimit", 9],
  ["regionLimit", 0],
  ["holeMeans", "both"],
  ["cardFillOrder", "descending"],
  ["wovenFaceDown", 1],
];

function injectProfile(input: FaultyInput, variant: number): Injection {
  const [field, value] = must(PROFILE_FAULTS[variant % PROFILE_FAULTS.length], "profile fault");
  return {
    input: { ...input, profile: { ...input.profile, [field]: value } },
    expected: { code: "PROFILE_INVALID", fields: { field, value } },
  };
}

const WEAVE_FAULTS: readonly (readonly [string, unknown, unknown])[] = [
  ["up", 0, { kind: "twill", up: 0, down: 1, direction: "Z" }],
  ["down", 1.5, { kind: "twill", up: 1, down: 1.5, direction: "S" }],
  ["direction", "X", { kind: "twill", up: 1, down: 1, direction: "X" }],
  ["size", 7, { kind: "satin", size: 7, move: 3, facing: "warp" }],
  ["move", 1, { kind: "satin", size: 5, move: 1, facing: "warp" }],
  ["move", 4, { kind: "satin", size: 8, move: 4, facing: "weft" }],
  ["facing", "front", { kind: "satin", size: 5, move: 2, facing: "front" }],
  ["kind", "basket", { kind: "basket" }],
];

function injectWeaveParameters(input: FaultyInput, variant: number): Injection {
  const [parameter, value, weave] = must(
    WEAVE_FAULTS[variant % WEAVE_FAULTS.length],
    "weave fault",
  );
  // A new highest region index, so exactly one assignment is invalid, and it is the one reported.
  const region = Math.max(-1, ...Object.keys(input.weaves).map(Number)) + 1;
  return {
    input: { ...input, weaves: { ...input.weaves, [region]: weave } },
    expected: { code: "WEAVE_INVALID", fields: { region, parameter, value } },
  };
}

const EMPTY_DESIGNS: readonly (readonly (readonly unknown[])[])[] = [[], [[]], [[], []]];

function injectEmptyDesign(input: FaultyInput, variant: number): Injection {
  const design = must(EMPTY_DESIGNS[variant % EMPTY_DESIGNS.length], "empty design");
  return { input: { ...input, design }, expected: { code: "DESIGN_EMPTY", fields: {} } };
}

function injectUnequalRows(input: FaultyInput): Injection {
  const rows = copyRows(input);
  const expected = must(rows[0], "design row 0").length;
  if (rows.length >= 2) {
    rows[1] = [...must(rows[1], "design row 1"), 0];
  } else {
    rows.push([...must(rows[0], "design row 0"), 0]);
  }
  return {
    input: { ...input, design: rows },
    expected: {
      code: "DESIGN_ROWS_UNEQUAL",
      fields: { pick: 1, length: expected + 1, expected },
    },
  };
}

const INVALID_CELL_VALUES: readonly unknown[] = [-1, 1.5, Number.NaN, "3", Number.POSITIVE_INFINITY, null];

function injectInvalidCell(input: FaultyInput, variant: number): Injection {
  const rows = copyRows(input);
  const width = must(rows[0], "design row 0").length;
  const cellCount = rows.length * width;
  const index = variant % cellCount;
  const pick = Math.floor(index / width);
  const end = index % width;
  const value = must(
    INVALID_CELL_VALUES[Math.floor(variant / cellCount) % INVALID_CELL_VALUES.length],
    "invalid cell value",
  );
  must(rows[pick], "design row")[end] = value;
  return {
    input: { ...input, design: rows },
    expected: { code: "DESIGN_CELL_INVALID", fields: { pick, end, value } },
  };
}

function injectTooWide(input: FaultyInput): Injection {
  const hookCount = numberField(input.profile, "hookCount");
  const width = hookCount + 1;
  return {
    input: { ...input, design: resizeRows(input.design, width) },
    expected: { code: "DESIGN_TOO_WIDE", fields: { width, hookCount } },
  };
}

function injectRepeatNotDivisible(input: FaultyInput, variant: number): Injection {
  const hookCount = numberField(input.profile, "hookCount");
  const widths: number[] = [];
  for (let width = 2; width < hookCount; width += 1) {
    if (hookCount % width !== 0) widths.push(width);
  }
  const width = widths[variant % Math.max(widths.length, 1)];
  if (width === undefined) throw new Error("arbitraries: repeatNotDivisible needs hookCount >= 3");
  return {
    input: { ...input, design: resizeRows(input.design, width), repeatAcross: true },
    expected: { code: "REPEAT_NOT_DIVISIBLE", fields: { width, hookCount } },
  };
}

function injectTooManyRegions(input: FaultyInput): Injection {
  const regionLimit = numberField(input.profile, "regionLimit");
  const regionCount = regionLimit + 1;
  const rows = copyRows(input);
  const width = must(rows[0], "design row 0").length;
  while (rows.length * width < regionCount) rows.push(Array.from({ length: width }, () => 0));
  // Every cell takes value (cell index mod regionCount): exactly regionCount distinct regions.
  const filled = rows.map((row, pick) => row.map((_, end) => (pick * width + end) % regionCount));
  const weaves: Record<number, unknown> = { ...input.weaves };
  for (let region = 0; region < regionCount; region += 1) {
    weaves[region] ??= { kind: "plain" };
  }
  return {
    input: { ...input, design: filled, weaves },
    expected: { code: "TOO_MANY_REGIONS", fields: { regionCount, regionLimit } },
  };
}

function injectMissingWeave(input: FaultyInput, variant: number): Injection {
  const used = [
    ...new Set(input.design.flatMap((row) => row.filter((cell) => typeof cell === "number"))),
  ].sort((a, b) => Number(a) - Number(b));
  const region = Number(must(used[variant % used.length], "used region"));
  const weaves: Record<number, unknown> = { ...input.weaves };
  delete weaves[region];
  return {
    input: { ...input, weaves },
    expected: { code: "WEAVE_MISSING", fields: { region } },
  };
}

/** Injects one fault. `variant` (any non-negative integer) picks among the fault's variants. */
export function injectFault(input: FaultyInput, kind: FaultKind, variant: number): Injection {
  switch (kind) {
    case "profile":
      return injectProfile(input, variant);
    case "weaveParameters":
      return injectWeaveParameters(input, variant);
    case "emptyDesign":
      return injectEmptyDesign(input, variant);
    case "unequalRows":
      return injectUnequalRows(input);
    case "invalidCell":
      return injectInvalidCell(input, variant);
    case "tooWide":
      return injectTooWide(input);
    case "repeatNotDivisible":
      return injectRepeatNotDivisible(input, variant);
    case "tooManyRegions":
      return injectTooManyRegions(input);
    case "missingWeave":
      return injectMissingWeave(input, variant);
  }
}

export interface FaultSpec {
  readonly kind: FaultKind;
  readonly variant: number;
}

export interface FaultedInput {
  readonly input: FaultyInput;
  /** The earliest injected fault in 3.7 order. */
  readonly earliest: FaultKind;
  readonly expected: ExpectedError;
}

/**
 * Applies the faults from the last step of 3.7 to the first. The result contains every injected
 * fault that no earlier injector destroyed, and always the earliest one, whose error is expected.
 * A kind listed twice is applied once, with its first variant.
 */
export function applyFaults(base: FaultyInput, specs: readonly FaultSpec[]): FaultedInput {
  const byKind = new Map<FaultKind, number>();
  for (const spec of specs) {
    if (!byKind.has(spec.kind)) byKind.set(spec.kind, spec.variant);
  }
  const kinds = FAULT_ORDER.filter((kind) => byKind.has(kind)).reverse();
  if (kinds.length === 0) throw new Error("arbitraries: applyFaults needs at least one fault");
  let input = base;
  let expected: ExpectedError | undefined;
  let earliest: FaultKind | undefined;
  for (const kind of kinds) {
    const injection = injectFault(input, kind, must(byKind.get(kind), "fault variant"));
    input = injection.input;
    expected = injection.expected;
    earliest = kind;
  }
  return {
    input,
    earliest: must(earliest, "earliest fault"),
    expected: must(expected, "expected error"),
  };
}

/** A non-empty subset of the nine faults, each with a random variant. */
export const faultSpecsArb: fc.Arbitrary<FaultSpec[]> = fc
  .subarray([...FAULT_ORDER], { minLength: 1 })
  .chain((kinds) =>
    fc
      .array(fc.nat(), { minLength: kinds.length, maxLength: kinds.length })
      .map((variants) =>
        kinds.map((kind, index) => ({ kind, variant: must(variants[index], "variant") })),
      ),
  );
