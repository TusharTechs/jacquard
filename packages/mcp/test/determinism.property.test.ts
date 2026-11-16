// Feature: weave-mcp, Property 14: Determinism
// Validates: Requirements 2.6, 4.5, 6.4, 7.6, 11.1, 11.6, 12.4
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { TOOL_NAMES, engineErrorCallArb, validCallArb } from "./arbitraries.js";
import { withConnection } from "./harness.js";

const SEED = 1414;
const NUM_RUNS = 100;

const callArb = fc.oneof(
  validCallArb,
  engineErrorCallArb,
  fc.record({ name: fc.constantFrom(...TOOL_NAMES), args: fc.dictionary(fc.string({ maxLength: 8 }), fc.jsonValue(), { maxKeys: 3 }) }),
  fc.record({ name: fc.string({ maxLength: 10 }), args: fc.constant({}) }),
);

function textOf(result: { content?: unknown }): string {
  return ((result.content as { text: string }[])[0] as { text: string }).text;
}

describe("Feature: weave-mcp, Property 14: Determinism", () => {
  it("gives byte-identical text on one connection and on two servers; errors carry no time, stack, path or pid", async () => {
    await fc.assert(
      fc.asyncProperty(callArb, async ({ name, args }) => {
        const [first, second, errorFlag] = await withConnection(async (connection) => {
          const a = await connection.call(name, args);
          const b = await connection.call(name, args);
          return [textOf(a), textOf(b), a.isError === true] as const;
        });
        const other = await withConnection(async (connection) => textOf(await connection.call(name, args)));
        expect(second).toBe(first);
        expect(other).toBe(first);
        if (errorFlag) {
          expect(first).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
          expect(first).not.toMatch(/\n\s+at |at .*:\d+:\d+/);
          expect(first).not.toMatch(/(^|[^A-Za-z])(\/Users\/|\/home\/|[A-Z]:\\\\)/);
          expect(first).not.toMatch(new RegExp(`(^|[^0-9])${process.pid}([^0-9]|$)`));
        }
      }),
      { seed: SEED, numRuns: NUM_RUNS, verbose: 1 },
    );
  });
});
