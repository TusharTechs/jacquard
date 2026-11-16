// fast-check generators for the simulate-and-export tests (design.md, "Correctness Properties").
// Plans are built only through the engine's public API (`buildLiftPlan`, `autoFix`,
// `defineProfile`), never from engine `src` or from this package's `src` helpers.
import * as fc from "fast-check";
import {
  PROFILE_120,
  PROFILE_240,
  PROFILE_400,
  autoFix,
  buildLiftPlan,
  defineProfile,
  type Design,
  type LiftPlan,
  type LoomProfile,
  type Side,
  type Weave,
} from "@jacquard/engine";

export interface YarnColours {
  readonly warp: string[];
  readonly weft: string[];
}

// ---------------------------------------------------------------------------------------------
// Colours
// ---------------------------------------------------------------------------------------------

const hex2 = (value: number): string => value.toString(16).padStart(2, "0");

/** A valid `#rrggbb` colour, sometimes with upper-case hex digits. */
export const hexColourArb: fc.Arbitrary<string> = fc
  .record({
    r: fc.integer({ min: 0, max: 255 }),
    g: fc.integer({ min: 0, max: 255 }),
    b: fc.integer({ min: 0, max: 255 }),
    upper: fc.boolean(),
  })
  .map(({ r, g, b, upper }) => {
    const text = `#${hex2(r)}${hex2(g)}${hex2(b)}`;
    return upper ? text.toUpperCase() : text;
  });

/** Yarn lists of 1 to 4 valid colours each. */
export const yarnsArb: fc.Arbitrary<YarnColours> = fc.record({
  warp: fc.array(hexColourArb, { minLength: 1, maxLength: 4 }),
  weft: fc.array(hexColourArb, { minLength: 1, maxLength: 4 }),
});

const VALID_HEX = /^#[0-9a-fA-F]{6}$/;

/** A string that is not a `#rrggbb` colour. */
export const badColourArb: fc.Arbitrary<string> = fc.oneof(
  fc.constantFrom("", "red", "#fff", "#gggggg", "#1234567", " #123456", "#12345 ", "123456", "#12 456", "rgb(1,2,3)"),
  fc.string({ maxLength: 8 }).filter((s) => !VALID_HEX.test(s)),
);

/** Yarns with exactly one fault: an empty list, or one list entry that is not `#rrggbb`. */
export const badYarnsArb: fc.Arbitrary<YarnColours> = fc
  .record({
    yarns: yarnsArb,
    list: fc.constantFrom("warp" as const, "weft" as const),
    empty: fc.boolean(),
    bad: badColourArb,
    at: fc.nat(),
  })
  .map(({ yarns, list, empty, bad, at }) => {
    const copy = { warp: [...yarns.warp], weft: [...yarns.weft] };
    if (empty) copy[list] = [];
    else copy[list][at % copy[list].length] = bad;
    return copy;
  });

export const sideArb: fc.Arbitrary<Side> = fc.constantFrom<Side>("face", "back");

// ---------------------------------------------------------------------------------------------
// Weaves and designs
// ---------------------------------------------------------------------------------------------

const SATIN_MOVES = { 5: [2, 3], 8: [3, 5] } as const;

export const weaveArb: fc.Arbitrary<Weave> = fc.oneof(
  fc.constant<Weave>({ kind: "plain" }),
  fc.record({
    kind: fc.constant("twill" as const),
    up: fc.integer({ min: 1, max: 4 }),
    down: fc.integer({ min: 1, max: 4 }),
    direction: fc.constantFrom("S" as const, "Z" as const),
  }),
  fc.constantFrom(5 as const, 8 as const).chain((size) =>
    fc.record({
      kind: fc.constant("satin" as const),
      size: fc.constant(size),
      move: fc.constantFrom(...SATIN_MOVES[size]),
      facing: fc.constantFrom("warp" as const, "weft" as const),
    }),
  ),
);

/** A rectangular design `design[pick][end]` with region indices 0 to regions - 1. */
export function designArb(
  maxWidth: number,
  maxPicks: number,
  maxRegions: number,
): fc.Arbitrary<{ design: number[][]; regions: number }> {
  return fc
    .record({
      width: fc.integer({ min: 1, max: maxWidth }),
      picks: fc.integer({ min: 1, max: maxPicks }),
      regions: fc.integer({ min: 1, max: maxRegions }),
    })
    .chain(({ width, picks, regions }) =>
      fc.record({
        design: fc.array(
          fc.array(fc.integer({ min: 0, max: regions - 1 }), { minLength: width, maxLength: width }),
          { minLength: picks, maxLength: picks },
        ),
        regions: fc.constant(regions),
      }),
    );
}

// ---------------------------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------------------------

/** A valid custom profile with `hookCount` hooks and varied card and side fields. */
function customProfileArb(hookCount: number): fc.Arbitrary<LoomProfile> {
  return fc
    .record({
      hooksPerCardRow: fc.integer({ min: 1, max: 8 }),
      spareHookCount: fc.integer({ min: 0, max: 4 }),
      holeMeans: fc.constantFrom("lift" as const, "noLift" as const),
      wovenFaceDown: fc.boolean(),
      maxFloat: fc.integer({ min: 2, max: 8 }),
    })
    .map((fields) => defineProfile({ hookCount, ...fields }));
}

// ---------------------------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------------------------

export interface PlanCase {
  readonly plan: LiftPlan;
  readonly profile: LoomProfile;
  readonly design: number[][];
}

function mustOk<T>(result: { ok: true; value: T } | { ok: false; error: unknown }, what: string): T {
  if (!result.ok) throw new Error(`arbitraries: ${what} failed: ${JSON.stringify(result.error)}`);
  return result.value;
}

/**
 * A valid lift plan from `buildLiftPlan` for a design of up to 16 ends by 16 picks and up to 4
 * regions, with a custom profile (hook count at least the width) or, now and then, a built-in
 * profile. `repeatAcross` is true only when the hook count is a multiple of the width. Half the
 * plans pass through `autoFix` when it succeeds.
 */
export const planCaseArb: fc.Arbitrary<PlanCase> = designArb(16, 16, 4).chain(({ design, regions }) => {
  const width = (design[0] as number[]).length;
  const hookCountArb = fc.oneof(
    fc.integer({ min: 0, max: 12 }).map((extra) => width + extra),
    fc.integer({ min: 1, max: 3 }).map((factor) => width * factor),
  );
  const profileArb = fc.oneof(
    { weight: 5, arbitrary: hookCountArb.chain(customProfileArb) },
    { weight: 1, arbitrary: fc.constantFrom(PROFILE_120, PROFILE_240, PROFILE_400) },
  );
  return fc
    .record({
      weaves: fc.array(weaveArb, { minLength: regions, maxLength: regions }),
      profile: profileArb,
      repeat: fc.boolean(),
      fix: fc.boolean(),
    })
    .map(({ weaves, profile, repeat, fix }): PlanCase => {
      const assignment: Record<number, Weave> = {};
      weaves.forEach((weave, region) => {
        assignment[region] = weave;
      });
      const repeatAcross = repeat && profile.hookCount % width === 0;
      const built = mustOk(
        buildLiftPlan({ design: design as Design, weaves: assignment, profile, repeatAcross }),
        "buildLiftPlan",
      );
      let plan = built.plan;
      if (fix) {
        const fixed = autoFix(plan, profile);
        if (fixed.ok) plan = fixed.value.plan;
      }
      return { plan, profile, design };
    });
});

type MutablePlan = { -readonly [K in keyof LiftPlan]: unknown } & { lifts: unknown[][] };

export const PLAN_FAULTS = [
  "noPicks",
  "pickCountUp",
  "hookCountUp",
  "rowLonger",
  "rowShorter",
  "notBoolean",
  "designWidthZero",
  "designWidthTooBig",
] as const;
export type PlanFault = (typeof PLAN_FAULTS)[number];

/** A deep copy of a valid plan with exactly one fault the engine's `validatePlan` rejects. */
export function corruptPlan(plan: LiftPlan, fault: PlanFault, at: number): LiftPlan {
  const bad = structuredClone(plan) as unknown as MutablePlan;
  const pick = at % plan.pickCount;
  const row = bad.lifts[pick] as unknown[];
  switch (fault) {
    case "noPicks":
      bad.pickCount = 0;
      break;
    case "pickCountUp":
      bad.pickCount = plan.pickCount + 1;
      break;
    case "hookCountUp":
      bad.hookCount = plan.hookCount + 1;
      break;
    case "rowLonger":
      row.push(false);
      break;
    case "rowShorter":
      row.pop();
      break;
    case "notBoolean":
      row[at % plan.hookCount] = 1;
      break;
    case "designWidthZero":
      bad.designWidth = 0;
      break;
    case "designWidthTooBig":
      bad.designWidth = plan.hookCount + 1;
      break;
  }
  return bad as unknown as LiftPlan;
}

export interface CorruptCase extends PlanCase {
  readonly corrupted: LiftPlan;
  readonly fault: PlanFault;
}

export const corruptCaseArb: fc.Arbitrary<CorruptCase> = fc
  .record({ c: planCaseArb, fault: fc.constantFrom(...PLAN_FAULTS), at: fc.nat() })
  .map(({ c, fault, at }) => ({ ...c, corrupted: corruptPlan(c.plan, fault, at), fault }));

/** Well-typed but invalid values for one profile field each. */
export const PROFILE_FAULTS: readonly Readonly<Record<string, unknown>>[] = [
  { hooksPerCardRow: 0 },
  { hooksPerCardRow: 2.5 },
  { hooksPerCardRow: -8 },
  { regionLimit: 9 },
  { regionLimit: 0 },
  { holeMeans: "x" },
  { spareHookCount: -1 },
  { maxFloat: 0 },
  { maxWarpFloat: 1.5 },
  { wovenFaceDown: "no" },
  { cardFillOrder: "descending" },
  { spareHookPlacement: "before" },
  { hookCount: 0 },
  { hookCount: 3.5 },
];

export interface BadProfileCase extends PlanCase {
  readonly badProfile: LoomProfile;
}

/** A valid plan with its valid profile and an invalid copy of that profile (one bad field). */
export const badProfileCaseArb: fc.Arbitrary<BadProfileCase> = fc
  .record({ c: planCaseArb, fault: fc.constantFrom(...PROFILE_FAULTS) })
  .map(({ c, fault }) => ({ ...c, badProfile: { ...c.profile, ...fault } as unknown as LoomProfile }));

// ---------------------------------------------------------------------------------------------
// Point paper
// ---------------------------------------------------------------------------------------------

export interface PointPaperCase {
  readonly design: number[][];
  readonly palette: string[];
}

/** A design up to 40 by 40 with up to 8 regions, and a palette with a colour for every region. */
export const pointPaperCaseArb: fc.Arbitrary<PointPaperCase> = designArb(40, 40, 8).chain(({ design, regions }) =>
  fc.record({
    design: fc.constant(design),
    palette: fc.array(hexColourArb, { minLength: regions, maxLength: regions + 2 }),
  }),
);

/** Titles mixing letters with characters that XML must escape. No control characters. */
export const titleArb: fc.Arbitrary<string> = fc.string({
  unit: fc.constantFrom("a", "Z", "7", " ", "<", ">", "&", '"', "'", "é", "[", "]", ";", "="),
  maxLength: 20,
});
