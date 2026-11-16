// Argument checking (Requirement 9). Presence, JSON type and key format only; every domain check
// (design shape, cell values, region limit, plan consistency) is left to the engine (9.8).
// Arguments are checked in declaration order and the first malformed one is reported (9.7).

export interface ArgumentError {
  readonly code: "ARGUMENT_INVALID";
  readonly argument: string;
  readonly message: string;
}

export type ArgKind = "design" | "weaves" | "profile" | "repeatAcross" | "plan" | "cardSet";

export interface ArgSpec {
  readonly name: string;
  readonly kind: ArgKind;
  readonly required: boolean;
}

export interface ToolArgSpec {
  readonly tool: string;
  readonly args: readonly ArgSpec[];
  /** When true, any argument not declared in `args` is an Argument_Error (5.6, auto_fix only). */
  readonly rejectExtra: boolean;
}

type JsonType = "object" | "array" | "string" | "number" | "boolean" | "null";

export const BUILT_IN_NAMES = ["120", "240", "400"] as const;

const CANONICAL_INTEGER = /^(0|[1-9][0-9]*)$/;

const PROFILE_FIELD_TYPES: readonly (readonly [string, JsonType])[] = [
  ["hookCount", "number"],
  ["hooksPerCardRow", "number"],
  ["spareHookCount", "number"],
  ["spareHookPlacement", "string"],
  ["maxFloat", "number"],
  ["maxWarpFloat", "number"],
  ["maxWeftFloat", "number"],
  ["regionLimit", "number"],
  ["holeMeans", "string"],
  ["cardFillOrder", "string"],
  ["wovenFaceDown", "boolean"],
];

export function argumentError(argument: string, message: string): ArgumentError {
  return { code: "ARGUMENT_INVALID", argument, message };
}

function jsonTypeOf(value: unknown): JsonType | "other" {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  switch (typeof value) {
    case "object":
      return "object";
    case "string":
      return "string";
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    default:
      return "other";
  }
}

function article(type: string): string {
  return /^[aeiou]/.test(type) ? `an ${type}` : `a ${type}`;
}

function describeType(value: unknown): string {
  const type = jsonTypeOf(value);
  if (type === "null") return "null";
  if (type === "other") return "a non-JSON value";
  return article(type);
}

function wrongType(path: string, expected: JsonType, value: unknown): ArgumentError {
  return argumentError(
    path,
    `Argument "${path}" must be ${article(expected)}; got ${describeType(value)}.`,
  );
}

function missing(path: string): ArgumentError {
  return argumentError(path, `Missing required argument "${path}".`);
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return jsonTypeOf(value) === "object";
}

/** Checks that `value[field]` is present and of `expected` JSON type; reports `path.field`. */
function field(
  container: Readonly<Record<string, unknown>>,
  path: string,
  name: string,
  expected: JsonType,
): ArgumentError | undefined {
  const fieldPath = `${path}.${name}`;
  const value = container[name];
  if (value === undefined || value === null) return missing(fieldPath);
  if (jsonTypeOf(value) !== expected) return wrongType(fieldPath, expected, value);
  return undefined;
}

function checkDesign(value: unknown, path: string): ArgumentError | undefined {
  if (!Array.isArray(value)) return wrongType(path, "array", value);
  for (let index = 0; index < value.length; index += 1) {
    const row: unknown = value[index];
    if (!Array.isArray(row)) return wrongType(`${path}[${index}]`, "array", row);
  }
  return undefined;
}

function checkWeaves(value: unknown, path: string): ArgumentError | undefined {
  if (!isRecord(value)) return wrongType(path, "object", value);
  for (const key of Object.keys(value)) {
    if (!CANONICAL_INTEGER.test(key)) {
      return argumentError(
        path,
        `Argument "${path}" has the key ${JSON.stringify(key)}, which is not a region index: ` +
          "keys must be non-negative integers written in decimal digits with no sign or leading zeros.",
      );
    }
  }
  for (const key of Object.keys(value)) {
    const weave = value[key];
    if (!isRecord(weave)) return wrongType(`${path}.${key}`, "object", weave);
  }
  return undefined;
}

function checkProfile(value: unknown, path: string): ArgumentError | undefined {
  if (typeof value === "string") {
    if ((BUILT_IN_NAMES as readonly string[]).includes(value)) return undefined;
    return argumentError(
      path,
      `Argument "${path}" must be one of the built-in profile names "120", "240" or "400", ` +
        `or an object of profile fields; got ${JSON.stringify(value)}.`,
    );
  }
  if (!isRecord(value)) {
    return argumentError(
      path,
      `Argument "${path}" must be a string ("120", "240" or "400") or an object; got ${describeType(value)}.`,
    );
  }
  if (value["hookCount"] === undefined) return missing(`${path}.hookCount`);
  for (const [name, expected] of PROFILE_FIELD_TYPES) {
    const fieldValue = value[name];
    if (fieldValue === undefined) continue;
    if (jsonTypeOf(fieldValue) !== expected) return wrongType(`${path}.${name}`, expected, fieldValue);
  }
  return undefined;
}

function checkRepeatAcross(value: unknown, path: string): ArgumentError | undefined {
  if (typeof value !== "boolean") return wrongType(path, "boolean", value);
  return undefined;
}

function checkPlan(value: unknown, path: string): ArgumentError | undefined {
  if (!isRecord(value)) return wrongType(path, "object", value);
  for (const [name, expected] of [
    ["pickCount", "number"],
    ["hookCount", "number"],
    ["designWidth", "number"],
    ["repeatAcross", "boolean"],
    ["lifts", "array"],
  ] as const) {
    const problem = field(value, path, name, expected);
    if (problem) return problem;
  }
  const lifts = value["lifts"] as readonly unknown[];
  for (let index = 0; index < lifts.length; index += 1) {
    const row: unknown = lifts[index];
    if (!Array.isArray(row)) return wrongType(`${path}.lifts[${index}]`, "array", row);
  }
  return undefined;
}

function checkCardSet(value: unknown, path: string): ArgumentError | undefined {
  if (!isRecord(value)) return wrongType(path, "object", value);
  for (const [name, expected] of [
    ["designWidth", "number"],
    ["repeatAcross", "boolean"],
    ["cards", "array"],
  ] as const) {
    const problem = field(value, path, name, expected);
    if (problem) return problem;
  }
  const cards = value["cards"] as readonly unknown[];
  for (let index = 0; index < cards.length; index += 1) {
    const cardPath = `${path}.cards[${index}]`;
    const card: unknown = cards[index];
    if (!isRecord(card)) return wrongType(cardPath, "object", card);
    for (const [name, expected] of [
      ["index", "number"],
      ["number", "number"],
      ["punched", "array"],
    ] as const) {
      const problem = field(card, cardPath, name, expected);
      if (problem) return problem;
    }
  }
  return undefined;
}

const CHECKS: Readonly<Record<ArgKind, (value: unknown, path: string) => ArgumentError | undefined>> = {
  design: checkDesign,
  weaves: checkWeaves,
  profile: checkProfile,
  repeatAcross: checkRepeatAcross,
  plan: checkPlan,
  cardSet: checkCardSet,
};

/**
 * Returns the first Argument_Error in declaration order, or `undefined` when every argument has the
 * right presence, JSON type and key format. An `args` value that is not an object counts as an
 * empty object. Reads the arguments only; never modifies them.
 */
export function checkArguments(spec: ToolArgSpec, args: unknown): ArgumentError | undefined {
  const record: Readonly<Record<string, unknown>> = isRecord(args) ? args : {};
  for (const arg of spec.args) {
    const value = record[arg.name];
    if (value === undefined || value === null) {
      if (arg.required) return missing(arg.name);
      if (value === null) return wrongType(arg.name, arg.kind === "repeatAcross" ? "boolean" : "object", value);
      continue;
    }
    const problem = CHECKS[arg.kind](value, arg.name);
    if (problem) return problem;
  }
  if (spec.rejectExtra) {
    const declared = new Set(spec.args.map((arg) => arg.name));
    for (const key of Object.keys(record)) {
      if (!declared.has(key)) {
        const accepted = spec.args.map((arg) => `"${arg.name}"`).join(" and ");
        return argumentError(
          key,
          `Unexpected argument "${key}" for ${spec.tool}; it accepts only ${accepted}.`,
        );
      }
    }
  }
  return undefined;
}
