// Property test for validation order (task 6.2): Property 16.
// Runs 200 fast-check cases. On a failure fast-check prints the shrunk counterexample and the seed.
import * as fc from "fast-check";
import { describe, it } from "vitest";
import { validateInput } from "../src/validate.js";
import type { RawInput } from "../src/validate.js";
import { FAULT_CODE, applyFaults, faultBaseArb, faultSpecsArb } from "./arbitraries.js";

describe("validation order", () => {
  it("Property 16: First error follows the validation order (Validates: Requirements 3.7)", () => {
    fc.assert(
      fc.property(faultBaseArb, faultSpecsArb, (base, specs) => {
        const faulted = applyFaults(base, specs);
        const result = validateInput(faulted.input as unknown as RawInput);
        return !result.ok && result.error.code === FAULT_CODE[faulted.earliest];
      }),
      { numRuns: 200 },
    );
  });
});
