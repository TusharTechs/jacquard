// Weaves (1.6, 1.7, 2.3). See design.md, "Components and Interfaces", Weaves.
//
// Phase and slope are fixed by 2.3 and confirmed by the user: every weave starts at the design
// origin (end 0, pick 0); plain is lifted at (0, 0); twill direction Z rises to the right on point
// paper drawn with pick 0 at the bottom, and S rises to the left.

import type { EngineResult } from "./errors.js";
import { weaveInvalid } from "./errors.js";
import { err, ok } from "./result.js";
import type { Weave } from "./types.js";

/** Allowed satin moves per size (1.6). A table, so the rule is visible in one place. */
const SATIN_MOVES: Readonly<Record<5 | 8, readonly number[]>> = {
  5: [2, 3],
  8: [3, 5],
};

/** The non-negative remainder of a divided by n, for a negative a as well. */
function mod(a: number, n: number): number {
  return ((a % n) + n) % n;
}

/** The weave period: 2 for plain, `up + down` for twill, `size` for satin (glossary). */
export function weavePeriod(weave: Weave): number {
  switch (weave.kind) {
    case "plain":
      return 2;
    case "twill":
      return weave.up + weave.down;
    case "satin":
      return weave.size;
  }
}

/**
 * Whether the hook for `end` lifts on `pick` under this weave (2.3). Takes any non-negative
 * integers. Does not validate the weave; use `validateWeave` first.
 */
export function evaluateWeave(weave: Weave, end: number, pick: number): boolean {
  switch (weave.kind) {
    case "plain":
      return (end + pick) % 2 === 0;
    case "twill": {
      const period = weave.up + weave.down;
      const offset = weave.direction === "Z" ? mod(end - pick, period) : mod(end + pick, period);
      return offset < weave.up;
    }
    case "satin": {
      const isBindingCell = mod(end, weave.size) === mod(weave.move * pick, weave.size);
      return weave.facing === "weft" ? isBindingCell : !isBindingCell;
    }
  }
}

function isPositiveInteger(value: unknown): boolean {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

/**
 * Checks a weave (1.7): its `kind`, then its parameters in declaration order. Returns the first bad
 * parameter as WEAVE_INVALID with the region index, the parameter name and its value. On success it
 * returns the same object it was given.
 */
export function validateWeave(region: number, weave: unknown): EngineResult<Weave> {
  if (typeof weave !== "object" || weave === null || Array.isArray(weave)) {
    return err(weaveInvalid(region, "kind", weave));
  }
  const fields = weave as Readonly<Record<string, unknown>>;

  switch (fields["kind"]) {
    case "plain":
      return ok(weave as Weave);

    case "twill":
      if (!isPositiveInteger(fields["up"])) return err(weaveInvalid(region, "up", fields["up"]));
      if (!isPositiveInteger(fields["down"])) {
        return err(weaveInvalid(region, "down", fields["down"]));
      }
      if (fields["direction"] !== "S" && fields["direction"] !== "Z") {
        return err(weaveInvalid(region, "direction", fields["direction"]));
      }
      return ok(weave as Weave);

    case "satin": {
      const size = fields["size"];
      if (size !== 5 && size !== 8) return err(weaveInvalid(region, "size", size));
      if (!SATIN_MOVES[size].includes(fields["move"] as number)) {
        return err(weaveInvalid(region, "move", fields["move"]));
      }
      if (fields["facing"] !== "warp" && fields["facing"] !== "weft") {
        return err(weaveInvalid(region, "facing", fields["facing"]));
      }
      return ok(weave as Weave);
    }

    default:
      return err(weaveInvalid(region, "kind", fields["kind"]));
  }
}
