// Tool definitions (1.1, 1.3, 1.4, 12.5). The ordered ArgSpec list and the JSON Schema come from
// one declaration, so they cannot disagree; the ArgSpec order is the declaration order of 9.7.
import type { ArgKind, ArgSpec, ToolArgSpec } from "./arguments.js";
import type { Handler } from "./handlers.js";
import {
  autoFixTool,
  buildCardsTool,
  buildLiftPlanTool,
  checkFloatsTool,
  decodeCardsTool,
  listProfiles,
} from "./handlers.js";

export const UNTESTED_SENTENCE = "The card format has not been tested on a working loom.";

export interface ToolDef {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: { readonly type: "object"; readonly [key: string]: unknown };
  readonly annotations: { readonly readOnlyHint: true };
  readonly spec: ToolArgSpec;
  readonly handler: Handler;
}

const PROFILE_FIELD_SCHEMA = {
  hookCount: { type: "integer", minimum: 1 },
  hooksPerCardRow: { type: "integer", minimum: 1 },
  spareHookCount: { type: "integer", minimum: 0 },
  spareHookPlacement: { type: "string", enum: ["afterFiguring"] },
  maxFloat: { type: "integer", minimum: 1 },
  maxWarpFloat: { type: "integer", minimum: 1 },
  maxWeftFloat: { type: "integer", minimum: 1 },
  regionLimit: { type: "integer", minimum: 1, maximum: 8 },
  holeMeans: { type: "string", enum: ["lift", "noLift"] },
  cardFillOrder: { type: "string", enum: ["ascending"] },
  wovenFaceDown: { type: "boolean" },
};

const SCHEMAS: Readonly<Record<ArgKind, Record<string, unknown>>> = {
  design: {
    type: "array",
    description: "design[pick][end]: one row per pick, one non-negative integer region index per end.",
    items: { type: "array", items: { type: "integer", minimum: 0 } },
  },
  weaves: {
    type: "object",
    description:
      "Region index (decimal string key) to weave: {kind:'plain'}, {kind:'twill',up,down,direction:'S'|'Z'} or {kind:'satin',size:5|8,move,facing:'warp'|'weft'}.",
    propertyNames: { pattern: "^(0|[1-9][0-9]*)$" },
    additionalProperties: { type: "object" },
  },
  profile: {
    description: 'A built-in loom profile name ("120", "240" or "400"), or an object of custom profile fields with at least hookCount.',
    oneOf: [
      { type: "string", enum: ["120", "240", "400"] },
      { type: "object", required: ["hookCount"], properties: PROFILE_FIELD_SCHEMA },
    ],
  },
  repeatAcross: {
    type: "boolean",
    description: "Tile the design across every hook. Default false.",
  },
  plan: {
    type: "object",
    description: "A lift plan as returned by build_lift_plan or auto_fix.",
    required: ["pickCount", "hookCount", "designWidth", "repeatAcross", "lifts"],
    properties: {
      pickCount: { type: "integer" },
      hookCount: { type: "integer" },
      designWidth: { type: "integer" },
      repeatAcross: { type: "boolean" },
      lifts: { type: "array", items: { type: "array", items: { type: "boolean" } } },
    },
  },
  cardSet: {
    type: "object",
    description: "A card set as returned by build_cards.",
    required: ["designWidth", "repeatAcross", "cards"],
    properties: {
      designWidth: { type: "integer" },
      repeatAcross: { type: "boolean" },
      cards: {
        type: "array",
        items: {
          type: "object",
          required: ["index", "number", "punched"],
          properties: {
            index: { type: "integer" },
            number: { type: "integer" },
            punched: { type: "array", items: { type: "boolean" } },
          },
        },
      },
    },
  },
};

function schemaOf(args: readonly ArgSpec[]): ToolDef["inputSchema"] {
  const properties: Record<string, unknown> = {};
  for (const arg of args) properties[arg.name] = SCHEMAS[arg.kind];
  return {
    type: "object",
    properties,
    required: args.filter((arg) => arg.required).map((arg) => arg.name),
  };
}

function tool(
  name: string,
  description: string,
  args: readonly ArgSpec[],
  handler: Handler,
  rejectExtra = false,
): ToolDef {
  return {
    name,
    description,
    inputSchema: schemaOf(args),
    annotations: { readOnlyHint: true },
    spec: { tool: name, args, rejectExtra },
    handler,
  };
}

const PLAN_AND_PROFILE: readonly ArgSpec[] = [
  { name: "plan", kind: "plan", required: true },
  { name: "profile", kind: "profile", required: true },
];

export const TOOL_DEFS: readonly ToolDef[] = [
  tool(
    "list_profiles",
    "List the built-in loom profiles (120, 240 and 400 hooks). Every field comes with its label: [sourced] (stated in a 1909 source, not checked on a loom), [convention], [decision] or [to verify].",
    [],
    listProfiles,
  ),
  tool(
    "build_lift_plan",
    "Build a lift plan from a design (a grid of region indices, one row per pick and one column per end), a weave for each region and a loom profile. Returns the plan, the idle hooks and any seam warnings. Engine errors come back unchanged.",
    [
      { name: "design", kind: "design", required: true },
      { name: "weaves", kind: "weaves", required: true },
      { name: "profile", kind: "profile", required: true },
      { name: "repeatAcross", kind: "repeatAcross", required: false },
    ],
    buildLiftPlanTool,
  ),
  tool(
    "check_floats",
    "List every float on the face or back that is longer than the loom profile allows, and every unbound line, in a fixed order. An empty list means the plan is within the limits.",
    PLAN_AND_PROFILE,
    checkFloatsTool,
  ),
  tool(
    "auto_fix",
    "Add binding points to a lift plan so that no float exceeds the profile limit, flipping as few cells as possible. Returns the fixed plan and the flipped cells, or AUTOFIX_FAILED with the violations left. Takes no options.",
    PLAN_AND_PROFILE,
    autoFixTool,
    true,
  ),
  tool(
    "build_cards",
    `Encode a lift plan as a punch-card set: one card per pick, numbered from 1 in lacing order, with each card laid out in rows for the profile. ${UNTESTED_SENTENCE}`,
    PLAN_AND_PROFILE,
    buildCardsTool,
  ),
  tool(
    "decode_cards",
    `Decode a punch-card set back to its lift plan, checking card sizes, numbering and positions that must never lift. ${UNTESTED_SENTENCE}`,
    [
      { name: "cardSet", kind: "cardSet", required: true },
      { name: "profile", kind: "profile", required: true },
    ],
    decodeCardsTool,
  ),
];
