// Feature: weave-mcp, Property 16: Unexpected exceptions become INTERNAL_ERROR
// Validates: Requirements 8.3, 8.4, 11.6
import * as fc from "fast-check";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { validCallArb } from "./arbitraries.js";
import { TOOL_OPERATIONS, throwingEngine, withConnection } from "./harness.js";
import type { EngineFunctionName } from "./harness.js";

const SEED = 1616;
const NUM_RUNS = 100;
const INTERNAL = '{"code":"INTERNAL_ERROR","message":"Internal error."}';

const thrownArb: fc.Arbitrary<{ value: unknown; parts: string[] }> = fc.oneof(
  fc
    .record({
      message: fc.oneof(
        fc.string({ minLength: 3, maxLength: 20 }),
        fc.constantFrom("/Users/someone/secret/file.ts", "C:\\work\\x.ts", "ENOENT: /etc/passwd"),
      ),
      stack: fc.constantFrom("Error: boom\n    at f (/Users/x/a.ts:1:2)", "at g (C:\\y\\b.js:3:4)"),
    })
    .map(({ message, stack }) => {
      const error = new Error(message);
      error.stack = stack;
      return { value: error, parts: [message, stack] };
    }),
  fc.string({ minLength: 3, maxLength: 20 }).map((s) => ({ value: s, parts: [s] })),
  fc.record({ secret: fc.string({ minLength: 3, maxLength: 10 }) }).map((o) => ({ value: o, parts: [o.secret] })),
);

const caseArb = validCallArb
  .filter((call) => call.name !== "list_profiles")
  .chain((call) => {
    const ops = [...(TOOL_OPERATIONS[call.name] ?? [])] as EngineFunctionName[];
    if (typeof call.args["profile"] === "object") ops.push("defineProfile", "validateProfile");
    return fc.record({ call: fc.constant(call), fn: fc.constantFrom(...ops), thrown: thrownArb });
  });

let silence: ReturnType<typeof vi.spyOn>;
beforeAll(() => {
  silence = vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterAll(() => {
  silence.mockRestore();
});

describe("Feature: weave-mcp, Property 16: Unexpected exceptions become INTERNAL_ERROR", () => {
  it("returns the fixed INTERNAL_ERROR with nothing of the thrown value, and keeps answering", async () => {
    await fc.assert(
      fc.asyncProperty(caseArb, async ({ call, fn, thrown }) => {
        await withConnection(async (connection) => {
          const result = await connection.call(call.name, call.args);
          expect(result.isError).toBe(true);
          expect(result.structuredContent).toStrictEqual({ code: "INTERNAL_ERROR", message: "Internal error." });
          const text = ((result.content as { text: string }[])[0] as { text: string }).text;
          expect(text).toBe(INTERNAL);
          for (const part of thrown.parts) {
            if (!INTERNAL.includes(part)) expect(text).not.toContain(part);
          }
          const next = await connection.call("list_profiles", {});
          expect(next.isError).not.toBe(true);
        }, throwingEngine(fn, thrown.value));
      }),
      { seed: SEED, numRuns: NUM_RUNS, verbose: 1 },
    );
  });
});
