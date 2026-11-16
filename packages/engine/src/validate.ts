// Input validation (1.5, 1.7, 2.6, Requirement 3). See design.md, "Error Handling", Validation order.
//
// `validateInput` runs the nine steps of 3.7 in order and returns the first failure. It reads the
// caller's arrays without copying or normalising them, so every reported position refers to the
// caller's own data.

import type { EngineResult } from "./errors.js";
import {
  designCellInvalid,
  designEmpty,
  designRowsUnequal,
  designTooWide,
  repeatNotDivisible,
  tooManyRegions,
  weaveMissing,
} from "./errors.js";
import { validateProfile } from "./profiles.js";
import { err, ok } from "./result.js";
import type { BuildInput, LoomProfile } from "./types.js";
import { validateWeave } from "./weaves.js";

/**
 * Input as it arrives from outside the engine. Every field is `unknown` because validation is what
 * establishes its type. Only `repeatAcross: true` turns "repeat across" on.
 */
export interface RawInput {
  readonly design: unknown;
  readonly weaves: unknown;
  readonly profile: unknown;
  readonly repeatAcross?: unknown;
}

function lengthOf(row: unknown): number {
  return Array.isArray(row) ? row.length : 0;
}

/** Region indices that have an assignment: own keys that are canonical non-negative integers, ascending. */
function assignedRegions(weaves: unknown): number[] {
  if (typeof weaves !== "object" || weaves === null || Array.isArray(weaves)) return [];
  return Object.keys(weaves)
    .filter((key) => /^(0|[1-9][0-9]*)$/.test(key))
    .map(Number)
    .sort((a, b) => a - b);
}

/**
 * Runs the nine checks of 3.7, in order, and returns the first failure:
 * 1. profile (1.5); 2. weave parameters of every assignment, used or not (1.7); 3. empty design;
 * 4. unequal rows; 5. invalid cell; 6. width; 7. "repeat across" divisibility; 8. region count;
 * 9. a used region with no weave.
 *
 * A design that is not an array, or whose first row is not an array, counts as empty. A row that is
 * not an array counts as length 0. `weaves` keys that are not canonical non-negative integers are
 * ignored, and a `weaves` value that is not an object counts as having no assignments.
 *
 * On success it returns the same input object, typed as `BuildInput`.
 */
export function validateInput(input: RawInput): EngineResult<BuildInput> {
  // 1. profile
  const profileResult = validateProfile(input.profile);
  if (!profileResult.ok) return err(profileResult.error);
  const profile: LoomProfile = profileResult.value;

  // 2. weave parameters, in ascending region order, used or not
  const weaves = (typeof input.weaves === "object" && input.weaves !== null
    ? input.weaves
    : {}) as Readonly<Record<string, unknown>>;
  const regions = assignedRegions(input.weaves);
  for (const region of regions) {
    const weaveResult = validateWeave(region, weaves[String(region)]);
    if (!weaveResult.ok) return err(weaveResult.error);
  }

  // 3. empty design
  const design = input.design;
  if (!Array.isArray(design) || design.length === 0 || lengthOf(design[0]) === 0) {
    return err(designEmpty());
  }
  const rows = design as readonly unknown[];
  const width = lengthOf(rows[0]);

  // 4. unequal rows: the first pick whose length differs from pick 0
  for (let pick = 1; pick < rows.length; pick += 1) {
    const length = lengthOf(rows[pick]);
    if (length !== width) return err(designRowsUnequal(pick, length, width));
  }

  // 5. invalid cell: the first cell in pick-major order that is not a non-negative safe integer
  for (let pick = 0; pick < rows.length; pick += 1) {
    const row = rows[pick] as readonly unknown[];
    for (let end = 0; end < width; end += 1) {
      const value = row[end];
      if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
        return err(designCellInvalid(pick, end, value));
      }
    }
  }

  // 6. width
  if (width > profile.hookCount) return err(designTooWide(width, profile.hookCount));

  // 7. "repeat across" divisibility
  const repeatAcross = input.repeatAcross === true;
  if (repeatAcross && profile.hookCount % width !== 0) {
    return err(repeatNotDivisible(width, profile.hookCount));
  }

  // 8. region count
  const used = new Set<number>();
  for (const row of rows as readonly (readonly number[])[]) {
    for (const value of row) used.add(value);
  }
  if (used.size > profile.regionLimit) return err(tooManyRegions(used.size, profile.regionLimit));

  // 9. a used region with no weave: the lowest one
  const assigned = new Set(regions);
  for (const region of [...used].sort((a, b) => a - b)) {
    if (!assigned.has(region)) return err(weaveMissing(region));
  }

  return ok(input as BuildInput);
}
