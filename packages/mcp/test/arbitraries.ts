// fast-check generators for the weave-mcp tests (design, Testing Strategy). They use only the public
// engine API (`@jacquard/engine`), never engine `src` or engine `test` files (13.3).
import * as fc from "fast-check";
import {
  PROFILE_120,
  PROFILE_240,
  PROFILE_400,
  autoFix,
  buildCards,
  buildLiftPlan,
  defineProfile,
} from "@jacquard/engine";
import type {
  CardSet,
  Design,
  LiftPlan,
  LoomProfile,
  ProfileFields,
  Weave,
} from "@jacquard/engine";

export type ToolName =
  | "list_profiles"
  | "build_lift_plan"
  | "check_floats"
  | "auto_fix"
  | "build_cards"
  | "decode_cards";

export const TOOL_NAMES: readonly ToolName[] = [
  "list_profiles",
  "build_lift_plan",
  "check_floats",
  "auto_fix",
  "build_cards",
  "decode_cards",
];

/** Declared argument order per tool, as in the design table. */
export const DECLARED_ARGS: Readonly<Record<ToolName, readonly string[]>> = {
  list_profiles: [],
  build_lift_plan: ["design", "weaves", "profile", "repeatAcross"],
  check_floats: ["plan", "profile"],
  auto_fix: ["plan", "profile"],
  build_cards: ["plan", "profile"],
  decode_cards: ["cardSet", "profile"],
};

export const REQUIRED_ARGS: Readonly<Record<ToolName, readonly string[]>> = {
  list_profiles: [],
  build_lift_plan: ["design", "weaves", "profile"],
  check_floats: ["plan", "profile"],
  auto_fix: ["plan", "profile"],
  build_cards: ["plan", "profile"],
  decode_cards: ["cardSet", "profile"],
};

export type ProfileArgument = "120" | "240" | "400" | ProfileFields;

/** A profile argument together with the profile the engine resolves it to. */
export interface ProfileCase {
  readonly argument: ProfileArgument;
  readonly profile: LoomProfile;
}

export interface ToolCall {
  readonly name: ToolName;
  readonly args: Record<string, unknown>;
}

// ---------------------------------------------------------------------------------------------
// Weaves
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

/** A weave for every region 0 to regionCount - 1, as a JSON object with string keys. */
export function weavesArb(regionCount: number): fc.Arbitrary<Record<string, Weave>> {
  return fc.array(weaveArb, { minLength: regionCount, maxLength: regionCount }).map((list) => {
    const weaves: Record<string, Weave> = {};
    list.forEach((weave, region) => {
      weaves[String(region)] = weave;
    });
    return weaves;
  });
}

// ---------------------------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------------------------

export const builtInCaseArb: fc.Arbitrary<ProfileCase> = fc.constantFrom<ProfileCase>(
  { argument: "120", profile: PROFILE_120 },
  { argument: "240", profile: PROFILE_240 },
  { argument: "400", profile: PROFILE_400 },
);

/** A valid custom profile with at least `minHooks` hooks and a low float limit (2 to 4). */
export function customCaseArb(minHooks: number): fc.Arbitrary<ProfileCase> {
  return fc
    .record(
      {
        hookCount: fc.integer({ min: minHooks, max: minHooks + 12 }),
        hooksPerCardRow: fc.integer({ min: 1, max: 8 }),
        spareHookCount: fc.integer({ min: 0, max: 3 }),
        maxFloat: fc.integer({ min: 2, max: 4 }),
        regionLimit: fc.integer({ min: 4, max: 8 }),
        holeMeans: fc.constantFrom("lift" as const, "noLift" as const),
        wovenFaceDown: fc.boolean(),
      },
      { requiredKeys: ["hookCount", "maxFloat"] },
    )
    .map((fields) => {
      const argument: ProfileFields = fields;
      return { argument, profile: defineProfile(argument) };
    });
}

export function profileCaseArb(minHooks: number): fc.Arbitrary<ProfileCase> {
  return fc.oneof(builtInCaseArb, customCaseArb(minHooks));
}

// ---------------------------------------------------------------------------------------------
// Designs and build inputs
// ---------------------------------------------------------------------------------------------

export interface BuildCase {
  readonly design: number[][];
  readonly weaves: Record<string, Weave>;
  readonly profileCase: ProfileCase;
  /** Absent, true or false (3.2). */
  readonly repeatAcross: boolean | undefined;
}

export function designArb(maxWidth = 12, maxPicks = 12, maxRegions = 4) {
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

/** A build input the engine accepts. With repeatAcross true the hook count is a multiple of the width. */
export const buildCaseArb: fc.Arbitrary<BuildCase> = designArb().chain(({ design, regions }) => {
  const width = (design[0] as number[]).length;
  return fc.record({
    design: fc.constant(design),
    weaves: weavesArb(regions),
    repeat: fc.constantFrom<boolean | undefined>(undefined, false, true),
    factor: fc.integer({ min: 1, max: 3 }),
    custom: customCaseArb(width),
    builtIn: builtInCaseArb,
    useBuiltIn: fc.boolean(),
  }).map(({ design, weaves, repeat, factor, custom, builtIn, useBuiltIn }): BuildCase => {
    let profileCase = useBuiltIn ? builtIn : custom;
    if (repeat === true && profileCase.profile.hookCount % width !== 0) {
      const argument = { ...(custom.argument as ProfileFields), hookCount: width * factor };
      profileCase = { argument, profile: defineProfile(argument) };
    }
    return { design, weaves, profileCase, repeatAcross: repeat };
  });
});

export function buildArgs(c: BuildCase): Record<string, unknown> {
  const args: Record<string, unknown> = { design: c.design, weaves: c.weaves, profile: c.profileCase.argument };
  if (c.repeatAcross !== undefined) args["repeatAcross"] = c.repeatAcross;
  return args;
}

function mustOk<T>(result: { ok: true; value: T } | { ok: false; error: unknown }, what: string): T {
  if (!result.ok) throw new Error(`arbitraries: ${what} failed: ${JSON.stringify(result.error)}`);
  return result.value;
}

export interface PlanCase {
  readonly plan: LiftPlan;
  readonly profileCase: ProfileCase;
}

/** A valid lift plan from buildLiftPlan, sometimes passed through autoFix so clean plans occur too. */
export const planCaseArb: fc.Arbitrary<PlanCase> = fc
  .record({ build: buildCaseArb, fix: fc.boolean() })
  .map(({ build, fix }) => {
    const out = mustOk(
      buildLiftPlan({
        design: build.design as Design,
        weaves: build.weaves,
        profile: build.profileCase.profile,
        repeatAcross: build.repeatAcross ?? false,
      }),
      "buildLiftPlan",
    );
    let plan = out.plan;
    if (fix) {
      const fixed = autoFix(plan, build.profileCase.profile);
      if (fixed.ok) plan = fixed.value.plan;
    }
    return { plan, profileCase: build.profileCase };
  });

export interface CardCase {
  readonly cardSet: CardSet;
  readonly plan: LiftPlan;
  readonly profileCase: ProfileCase;
}

export const cardCaseArb: fc.Arbitrary<CardCase> = planCaseArb.map(({ plan, profileCase }) => ({
  cardSet: mustOk(buildCards(plan, profileCase.profile), "buildCards"),
  plan,
  profileCase,
}));

/** A valid call of any tool. */
export const validCallArb: fc.Arbitrary<ToolCall> = fc.oneof(
  fc.constant<ToolCall>({ name: "list_profiles", args: {} }),
  buildCaseArb.map((c): ToolCall => ({ name: "build_lift_plan", args: buildArgs(c) })),
  planCaseArb.chain((c) =>
    fc.constantFrom<ToolName>("check_floats", "auto_fix", "build_cards").map(
      (name): ToolCall => ({ name, args: { plan: c.plan, profile: c.profileCase.argument } }),
    ),
  ),
  cardCaseArb.map(
    (c): ToolCall => ({ name: "decode_cards", args: { cardSet: c.cardSet, profile: c.profileCase.argument } }),
  ),
);

// ---------------------------------------------------------------------------------------------
// One-fault corruptions that pass argument checking but fail in the engine (Property 10)
// ---------------------------------------------------------------------------------------------

function copy<T>(value: T): T {
  return structuredClone(value);
}

/** Calls whose arguments have the right JSON shape but that the engine rejects. */
export const engineErrorCallArb: fc.Arbitrary<ToolCall> = fc.oneof(
  // build_lift_plan: invalid cell, unequal rows, too many regions, missing weave, invalid weave, empty
  buildCaseArb.chain((c) =>
    fc.constantFrom("cell", "rows", "regions", "missingWeave", "badWeave", "empty", "tooWide").map(
      (fault): ToolCall => {
        const args = buildArgs(copy(c));
        const design = args["design"] as number[][];
        const weaves = args["weaves"] as Record<string, unknown>;
        switch (fault) {
          case "cell":
            (design[0] as number[])[0] = -1;
            break;
          case "rows":
            design.push([...(design[0] as number[]), 0]);
            break;
          case "regions": {
            const limit = c.profileCase.profile.regionLimit;
            const row: number[] = [];
            for (let r = 0; r <= limit; r += 1) row.push(r);
            args["design"] = [row];
            args["profile"] = { hookCount: limit + 1 };
            args["repeatAcross"] = false;
            break;
          }
          case "missingWeave":
            delete weaves["0"];
            break;
          case "badWeave":
            weaves["0"] = { kind: "twill", up: 0, down: 1, direction: "S" };
            break;
          case "empty":
            args["design"] = [];
            break;
          case "tooWide":
            args["design"] = [new Array(c.profileCase.profile.hookCount + 1).fill(0)];
            args["repeatAcross"] = false;
            break;
        }
        return { name: "build_lift_plan", args };
      },
    ),
  ),
  // any tool: a well-typed but invalid custom profile field
  fc
    .record({
      call: validCallArb.filter((call) => call.name !== "list_profiles"),
      fault: fc.constantFrom(
        { hookCount: 0 },
        { hookCount: 2.5 },
        { hookCount: 12, regionLimit: 9 },
        { hookCount: 12, holeMeans: "x" },
        { hookCount: 12, maxFloat: -1 },
        { hookCount: 12, spareHookPlacement: "before" },
      ),
    })
    .map(({ call, fault }): ToolCall => ({ name: call.name, args: { ...call.args, profile: fault } })),
  // plan tools: corrupted lift plan
  planCaseArb.chain((c) =>
    fc
      .record({
        name: fc.constantFrom<ToolName>("check_floats", "auto_fix", "build_cards"),
        fault: fc.constantFrom("noPicks", "pickCount", "hookCount", "rowLength", "notBoolean"),
      })
      .map(({ name, fault }): ToolCall => {
        const plan = copy(c.plan) as { -readonly [K in keyof LiftPlan]: unknown } & { lifts: unknown[][] };
        switch (fault) {
          case "noPicks":
            plan.pickCount = 0;
            break;
          case "pickCount":
            plan.pickCount = (plan.pickCount as number) + 1;
            break;
          case "hookCount":
            plan.hookCount = (plan.hookCount as number) + 1;
            break;
          case "rowLength":
            (plan.lifts[0] as unknown[]).push(false);
            break;
          case "notBoolean":
            (plan.lifts[0] as unknown[])[0] = 1;
            break;
        }
        return { name, args: { plan, profile: c.profileCase.argument } };
      }),
  ),
  // decode_cards: corrupted card set
  cardCaseArb.chain((c) =>
    fc.constantFrom("empty", "duplicate", "missing", "size", "spare", "idle").map((fault): ToolCall => {
      const cardSet = copy(c.cardSet) as { designWidth: number; repeatAcross: boolean; cards: { index: number; number: number; punched: boolean[] }[] };
      let profile: ProfileArgument = c.profileCase.argument;
      const first = cardSet.cards[0] as { index: number; number: number; punched: boolean[] };
      const down = c.profileCase.profile.holeMeans === "noLift";
      switch (fault) {
        case "empty":
          cardSet.cards = [];
          break;
        case "duplicate":
          cardSet.cards.push({ ...first, punched: [...first.punched] });
          break;
        case "missing":
          first.number = cardSet.cards.length + 1;
          break;
        case "size":
          first.punched.push(false);
          break;
        case "spare": {
          // Rebuild the cards for a profile with one spare hook, then lift that spare on card 1.
          const spareProfile: ProfileFields = {
            hookCount: c.profileCase.profile.hookCount,
            spareHookCount: 1,
            holeMeans: "lift",
          };
          profile = spareProfile;
          const rebuilt = mustOk(buildCards(c.plan, defineProfile(spareProfile)), "buildCards");
          const cards = copy(rebuilt.cards) as { index: number; number: number; punched: boolean[] }[];
          const card = cards[0] as { punched: boolean[] };
          card.punched[card.punched.length - 1] = true;
          cardSet.cards = cards;
          break;
        }
        case "idle": {
          // Lift an idle position: requires a design narrower than the hook count without repeat.
          cardSet.repeatAcross = false;
          cardSet.designWidth = 0;
          first.punched[0] = !down;
          break;
        }
      }
      return { name: "decode_cards", args: { cardSet, profile } };
    }),
  ),
);

// ---------------------------------------------------------------------------------------------
// Weave keys (Property 13)
// ---------------------------------------------------------------------------------------------

/** Keys that are not canonical decimal text of a non-negative integer. */
export const nonCanonicalKeyArb: fc.Arbitrary<string> = fc.oneof(
  fc.constant(""),
  fc.integer({ min: 0, max: 99 }).map((n) => `0${n}`),
  fc.integer({ min: 0, max: 99 }).map((n) => `-${n}`),
  fc.integer({ min: 0, max: 99 }).map((n) => `+${n}`),
  fc.integer({ min: 0, max: 99 }).map((n) => `${n}.0`),
  fc.integer({ min: 0, max: 99 }).map((n) => ` ${n}`),
  fc.integer({ min: 0, max: 99 }).map((n) => `${n} `),
  fc.string({ minLength: 1, maxLength: 4 }).filter((s) => !/^(0|[1-9][0-9]*)$/.test(s)),
);
