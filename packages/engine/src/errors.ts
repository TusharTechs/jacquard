// Typed errors for every expected failure (3.8). See design.md, "Error Handling".
// Each error has a stable `code`, the values named in its criterion as fields, and a `message`
// built only from those fields.

import type { Result } from "./result.js";
import type { Violation } from "./types.js";

export type PlanProblem =
  | "noPicks"
  | "pickCountMismatch"
  | "hookCountMismatch"
  | "rowLength"
  | "notBoolean"
  | "designWidth"
  | "repeatNotDivisible"
  | "idleLifted"
  | "notPeriodic";

type EngineErrorFields =
  | { readonly code: "PROFILE_INVALID"; readonly field: string; readonly value: unknown } // 1.5
  | {
      readonly code: "WEAVE_INVALID";
      readonly region: number;
      readonly parameter: string;
      readonly value: unknown;
    } // 1.7
  | { readonly code: "DESIGN_EMPTY" } // 3.3
  | {
      readonly code: "DESIGN_ROWS_UNEQUAL";
      readonly pick: number;
      readonly length: number;
      readonly expected: number;
    } // 3.4
  | {
      readonly code: "DESIGN_CELL_INVALID";
      readonly pick: number;
      readonly end: number;
      readonly value: unknown;
    } // 3.5
  | { readonly code: "DESIGN_TOO_WIDE"; readonly width: number; readonly hookCount: number } // 3.1
  | { readonly code: "REPEAT_NOT_DIVISIBLE"; readonly width: number; readonly hookCount: number } // 2.6
  | {
      readonly code: "TOO_MANY_REGIONS";
      readonly regionCount: number;
      readonly regionLimit: number;
    } // 3.2
  | { readonly code: "WEAVE_MISSING"; readonly region: number } // 3.6
  | {
      readonly code: "PLAN_INVALID";
      readonly problem: PlanProblem;
      readonly pick?: number;
      readonly hook?: number;
    } // 2.13
  | { readonly code: "CARDS_EMPTY" } // 2.11
  | {
      readonly code: "CARD_SIZE_MISMATCH";
      readonly number: number;
      readonly positionCount: number;
      readonly expected: number;
    } // 2.11
  | { readonly code: "CARD_NUMBER_DUPLICATE"; readonly number: number } // 2.11
  | { readonly code: "CARD_NUMBER_MISSING"; readonly number: number } // 2.11
  | { readonly code: "CARD_SPARE_LIFTED"; readonly number: number; readonly position: number } // 2.11
  | { readonly code: "CARD_IDLE_LIFTED"; readonly number: number; readonly position: number } // 2.11, 2.13
  | {
      readonly code: "AUTOFIX_FAILED";
      readonly reason: "stuck" | "iterationLimit";
      readonly maxIterations: number;
      readonly remaining: Violation[];
    }; // 5.8

export type EngineError = EngineErrorFields & { readonly message: string };

export type EngineErrorCode = EngineError["code"];

type ErrorOf<C extends EngineErrorCode> = Extract<EngineError, { readonly code: C }>;

/** The result type of every public function (design, Overview). */
export type EngineResult<T> = Result<T, EngineError>;

/** Describes any value for a message, without locale or environment lookups. */
function describeValue(value: unknown): string {
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") return Object.is(value, -0) ? "-0" : String(value);
  if (typeof value === "boolean") return String(value);
  if (typeof value === "bigint") return `${String(value)}n`;
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (Array.isArray(value)) return "an array";
  if (typeof value === "object") return "an object";
  return typeof value;
}

export function profileInvalid(field: string, value: unknown): ErrorOf<"PROFILE_INVALID"> {
  return {
    code: "PROFILE_INVALID",
    field,
    value,
    message: `Loom profile field "${field}" has an invalid value: ${describeValue(value)}.`,
  };
}

export function weaveInvalid(
  region: number,
  parameter: string,
  value: unknown,
): ErrorOf<"WEAVE_INVALID"> {
  return {
    code: "WEAVE_INVALID",
    region,
    parameter,
    value,
    message: `The weave for region ${region} has an invalid "${parameter}": ${describeValue(value)}.`,
  };
}

export function designEmpty(): ErrorOf<"DESIGN_EMPTY"> {
  return { code: "DESIGN_EMPTY", message: "The design is empty: it has no picks or no ends." };
}

export function designRowsUnequal(
  pick: number,
  length: number,
  expected: number,
): ErrorOf<"DESIGN_ROWS_UNEQUAL"> {
  return {
    code: "DESIGN_ROWS_UNEQUAL",
    pick,
    length,
    expected,
    message: `Design pick ${pick} has ${length} ends, but pick 0 has ${expected}.`,
  };
}

export function designCellInvalid(
  pick: number,
  end: number,
  value: unknown,
): ErrorOf<"DESIGN_CELL_INVALID"> {
  return {
    code: "DESIGN_CELL_INVALID",
    pick,
    end,
    value,
    message: `Design cell at pick ${pick}, end ${end} is not a non-negative integer: ${describeValue(value)}.`,
  };
}

export function designTooWide(width: number, hookCount: number): ErrorOf<"DESIGN_TOO_WIDE"> {
  return {
    code: "DESIGN_TOO_WIDE",
    width,
    hookCount,
    message: `The design is ${width} ends wide, but the loom profile has ${hookCount} hooks.`,
  };
}

export function repeatNotDivisible(
  width: number,
  hookCount: number,
): ErrorOf<"REPEAT_NOT_DIVISIBLE"> {
  return {
    code: "REPEAT_NOT_DIVISIBLE",
    width,
    hookCount,
    message: `"Repeat across" needs a design width that divides the hook count; the width is ${width} and the hook count is ${hookCount}.`,
  };
}

export function tooManyRegions(
  regionCount: number,
  regionLimit: number,
): ErrorOf<"TOO_MANY_REGIONS"> {
  return {
    code: "TOO_MANY_REGIONS",
    regionCount,
    regionLimit,
    message: `The design uses ${regionCount} regions, but the region limit is ${regionLimit}.`,
  };
}

export function weaveMissing(region: number): ErrorOf<"WEAVE_MISSING"> {
  return {
    code: "WEAVE_MISSING",
    region,
    message: `Region ${region} is used in the design but has no weave.`,
  };
}

export function planInvalid(
  problem: PlanProblem,
  pick?: number,
  hook?: number,
): ErrorOf<"PLAN_INVALID"> {
  const where =
    (pick === undefined ? "" : ` at pick ${pick}`) + (hook === undefined ? "" : ` at hook ${hook}`);
  const message = `The lift plan is invalid (${problem})${where}.`;
  // Absent optional fields are left out, so the object serialises the same way every time.
  if (pick !== undefined && hook !== undefined) {
    return { code: "PLAN_INVALID", problem, pick, hook, message };
  }
  if (pick !== undefined) return { code: "PLAN_INVALID", problem, pick, message };
  if (hook !== undefined) return { code: "PLAN_INVALID", problem, hook, message };
  return { code: "PLAN_INVALID", problem, message };
}

export function cardsEmpty(): ErrorOf<"CARDS_EMPTY"> {
  return { code: "CARDS_EMPTY", message: "The card set is empty." };
}

export function cardSizeMismatch(
  number: number,
  positionCount: number,
  expected: number,
): ErrorOf<"CARD_SIZE_MISMATCH"> {
  return {
    code: "CARD_SIZE_MISMATCH",
    number,
    positionCount,
    expected,
    message: `Card ${number} has ${positionCount} positions, but the loom profile needs ${expected}.`,
  };
}

export function cardNumberDuplicate(number: number): ErrorOf<"CARD_NUMBER_DUPLICATE"> {
  return {
    code: "CARD_NUMBER_DUPLICATE",
    number,
    message: `Card number ${number} appears more than once.`,
  };
}

export function cardNumberMissing(number: number): ErrorOf<"CARD_NUMBER_MISSING"> {
  return {
    code: "CARD_NUMBER_MISSING",
    number,
    message: `Card number ${number} is missing from the card set.`,
  };
}

export function cardSpareLifted(
  number: number,
  position: number,
): ErrorOf<"CARD_SPARE_LIFTED"> {
  return {
    code: "CARD_SPARE_LIFTED",
    number,
    position,
    message: `Card ${number} lifts spare position ${position}, which version 1 never lifts.`,
  };
}

export function cardIdleLifted(number: number, position: number): ErrorOf<"CARD_IDLE_LIFTED"> {
  return {
    code: "CARD_IDLE_LIFTED",
    number,
    position,
    message: `Card ${number} lifts idle position ${position}, which never lifts.`,
  };
}

export function autofixFailed(
  reason: "stuck" | "iterationLimit",
  maxIterations: number,
  remaining: Violation[],
): ErrorOf<"AUTOFIX_FAILED"> {
  return {
    code: "AUTOFIX_FAILED",
    reason,
    maxIterations,
    remaining,
    message: `Auto-fix failed (${reason}) with ${remaining.length} violations remaining; the iteration bound is ${maxIterations}.`,
  };
}
