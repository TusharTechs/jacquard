// Feature: weave-mcp, Property 11: The server keeps answering correctly after failures
// Validates: Requirements 1.5, 8.5, 11.2
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { TOOL_NAMES, engineErrorCallArb, validCallArb } from "./arbitraries.js";
import { withConnection } from "./harness.js";

const SEED = 1111;
const NUM_RUNS = 100;

type Step = { name: string; args: unknown };

const stepArb: fc.Arbitrary<Step> = fc.oneof(
  validCallArb,
  engineErrorCallArb,
  // invalid arguments: a required argument removed or replaced
  validCallArb
    .filter((call) => call.name !== "list_profiles")
    .chain((call) =>
      fc.constantFrom<unknown>(undefined, null, 7, "x", []).map((bad): Step => {
        const args = { ...call.args };
        const first = Object.keys(args)[0] as string;
        if (bad === undefined) delete args[first];
        else args[first] = bad;
        return { name: call.name, args };
      }),
    ),
  // unknown tool names
  fc
    .string({ maxLength: 12 })
    .filter((name) => !(TOOL_NAMES as readonly string[]).includes(name))
    .map((name): Step => ({ name, args: {} })),
);

describe("Feature: weave-mcp, Property 11: The server keeps answering correctly after failures", () => {
  it("answers each call in a mixed sequence as it would alone on a fresh connection", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(stepArb, { minLength: 1, maxLength: 8 }), async (steps) => {
        const inSequence = await withConnection(async (connection) => {
          const texts: string[] = [];
          for (const step of steps) {
            const result = await connection.call(step.name, step.args);
            texts.push((result.content as { text: string }[])[0]?.text ?? "");
            if (!(TOOL_NAMES as readonly string[]).includes(step.name)) {
              const body = result.structuredContent as { code: string; message: string };
              expect(body.code).toBe("TOOL_UNKNOWN");
              expect(body.message).toContain(step.name);
            }
          }
          return texts;
        });
        for (let i = 0; i < steps.length; i += 1) {
          const step = steps[i] as Step;
          const alone = await withConnection(async (connection) => {
            const result = await connection.call(step.name, step.args);
            return (result.content as { text: string }[])[0]?.text ?? "";
          });
          expect(inSequence[i]).toBe(alone);
        }
      }),
      { seed: SEED, numRuns: NUM_RUNS, verbose: 1 },
    );
  });
});
