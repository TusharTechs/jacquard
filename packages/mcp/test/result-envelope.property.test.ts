// Feature: weave-mcp, Property 6: Result envelope
// Validates: Requirements 8.2, 11.4
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { canonicalJson } from "../src/canonical-json.js";
import { TOOL_NAMES, engineErrorCallArb, validCallArb } from "./arbitraries.js";
import type { ToolCall } from "./arbitraries.js";
import { withConnection } from "./harness.js";

const SEED = 6006;
const NUM_RUNS = 100;

/** Valid calls, engine-error calls, argument errors and unknown names, tagged with the expected outcome. */
const anyCallArb: fc.Arbitrary<{ call: ToolCall | { name: string; args: unknown }; expectError: boolean | undefined }> =
  fc.oneof(
    // A valid auto_fix call may end in AUTOFIX_FAILED (for example a one-pick plan), so its outcome
    // is not known in advance; Property 7 compares it with the direct engine call.
    validCallArb.map((call) => ({ call, expectError: call.name === "auto_fix" ? undefined : false })),
    engineErrorCallArb.map((call) => ({ call, expectError: true })),
    fc
      .record({ name: fc.constantFrom(...TOOL_NAMES.slice(1)), args: fc.dictionary(fc.string(), fc.jsonValue(), { maxKeys: 3 }) })
      .map(({ name, args }) => ({ call: { name, args }, expectError: undefined })),
    fc
      .string()
      .filter((name) => !(TOOL_NAMES as readonly string[]).includes(name))
      .map((name) => ({ call: { name, args: {} }, expectError: true })),
  );

describe("Feature: weave-mcp, Property 6: Result envelope", () => {
  it("resolves, flags isError exactly for Tool_Errors, and holds one canonical text item", async () => {
    await withConnection(async (connection) => {
      await fc.assert(
        fc.asyncProperty(anyCallArb, async ({ call, expectError }) => {
          const result = await connection.call(call.name, call.args);
          const body = result.structuredContent as Record<string, unknown>;
          expect(result.content).toHaveLength(1);
          const item = (result.content as { type: string; text: string }[])[0] as { type: string; text: string };
          expect(item.type).toBe("text");
          expect(item.text).toBe(canonicalJson(body));
          const isToolError = typeof body["code"] === "string" && typeof body["message"] === "string";
          expect(result.isError === true).toBe(isToolError);
          if (expectError !== undefined) expect(result.isError === true).toBe(expectError);
        }),
        { seed: SEED, numRuns: NUM_RUNS, verbose: 1 },
      );
    });
  });
});
