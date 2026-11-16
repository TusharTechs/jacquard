// Property test for error fields (task 6.3): Property 17.
// Runs 200 fast-check cases. On a failure fast-check prints the shrunk counterexample and the seed.
import * as fc from "fast-check";
import { describe, it } from "vitest";
import {
  designCellInvalid,
  designEmpty,
  designRowsUnequal,
  designTooWide,
  profileInvalid,
  repeatNotDivisible,
  tooManyRegions,
  weaveInvalid,
  weaveMissing,
} from "../src/errors.js";
import type { EngineError } from "../src/errors.js";
import { validateInput } from "../src/validate.js";
import type { RawInput } from "../src/validate.js";
import { FAULT_CODE, applyFaults, faultBaseArb, faultSpecsArb } from "./arbitraries.js";

/** The message the engine's own constructor builds from the error's fields alone. */
function messageFromFields(error: EngineError): string | undefined {
  // Narrowing on `code` gives each field its real type, so no cast or index lookup is needed.
  switch (error.code) {
    case "PROFILE_INVALID":
      return profileInvalid(error.field, error.value).message;
    case "WEAVE_INVALID":
      return weaveInvalid(error.region, error.parameter, error.value).message;
    case "DESIGN_EMPTY":
      return designEmpty().message;
    case "DESIGN_ROWS_UNEQUAL":
      return designRowsUnequal(error.pick, error.length, error.expected).message;
    case "DESIGN_CELL_INVALID":
      return designCellInvalid(error.pick, error.end, error.value).message;
    case "DESIGN_TOO_WIDE":
      return designTooWide(error.width, error.hookCount).message;
    case "REPEAT_NOT_DIVISIBLE":
      return repeatNotDivisible(error.width, error.hookCount).message;
    case "TOO_MANY_REGIONS":
      return tooManyRegions(error.regionCount, error.regionLimit).message;
    case "WEAVE_MISSING":
      return weaveMissing(error.region).message;
    default:
      return undefined;
  }
}

describe("validation error fields", () => {
  it("Property 17: Errors carry their named fields (Validates: Requirements 1.5, 1.7, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.8)", () => {
    fc.assert(
      fc.property(faultBaseArb, faultSpecsArb, (base, specs) => {
        const faulted = applyFaults(base, specs);
        const result = validateInput(faulted.input as unknown as RawInput);
        if (result.ok) return false;
        const error = result.error;
        const actual = error as unknown as Record<string, unknown>;
        if (error.code !== FAULT_CODE[faulted.earliest]) return false;
        if (error.code !== faulted.expected.code) return false;

        // Exactly the named fields, plus code and message, with values matching the fault.
        const expectedKeys = Object.keys(faulted.expected.fields).sort();
        const actualKeys = Object.keys(actual)
          .filter((key) => key !== "code" && key !== "message")
          .sort();
        if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)) return false;
        for (const [key, value] of Object.entries(faulted.expected.fields)) {
          if (!Object.is(actual[key], value)) return false;
        }

        // The message is a string built from the fields alone.
        return typeof error.message === "string" && error.message === messageFromFields(error);
      }),
      { numRuns: 200 },
    );
  });
});
