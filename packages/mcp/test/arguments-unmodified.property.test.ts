// Feature: weave-mcp, Property 15: Arguments are never modified
// Validates: Requirements 4.3, 5.4, 6.5, 7.2, 10.5
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { TOOL_NAMES, engineErrorCallArb, validCallArb } from "./arbitraries.js";
import { withConnection } from "./harness.js";

const SEED = 1515;
const NUM_RUNS = 100;

const callArb = fc.oneof(
  validCallArb,
  engineErrorCallArb,
  fc.record({
    name: fc.constantFrom(...TOOL_NAMES),
    args: fc.dictionary(fc.string({ maxLength: 8 }).filter((k) => k !== "__proto__"), fc.jsonValue(), { maxKeys: 3 }),
  }),
);

describe("Feature: weave-mcp, Property 15: Arguments are never modified", () => {
  it("leaves the argument object deeply equal to a copy taken before the call", async () => {
    await withConnection(async (connection) => {
      await fc.assert(
        fc.asyncProperty(callArb, async ({ name, args }) => {
          // Both sides go through structuredClone, so a null-prototype argument object compares
          // equal to itself; added undefined members and changed values still fail toStrictEqual.
          const before = structuredClone(args);
          await connection.call(name, args);
          expect(structuredClone(args)).toStrictEqual(before);
        }),
        { seed: SEED, numRuns: NUM_RUNS, verbose: 1 },
      );
    });
  });
});
