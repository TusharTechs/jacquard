// Robustness fuzz (design, Testing Strategy; not a numbered property): arguments from fc.jsonValue()
// to every tool never produce INTERNAL_ERROR and never make the call reject. A failure means the
// engine throws on input that passes the shape check, or the shape check misses a container the
// engine reads. It is reported, not hidden by catching the exception.
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { TOOL_NAMES, DECLARED_ARGS, validCallArb } from "./arbitraries.js";
import { withConnection } from "./harness.js";

const SEED = 1717;
const NUM_RUNS = 300;

/** Arguments that are mostly JSON noise, sometimes one valid argument mixed with noise. */
const argsArb = fc.oneof(
  fc.record({
    name: fc.constantFrom(...TOOL_NAMES),
    args: fc.dictionary(fc.string({ maxLength: 8 }), fc.jsonValue(), { maxKeys: 4 }),
  }),
  fc.record({ name: fc.constantFrom(...TOOL_NAMES), value: fc.jsonValue() }).chain(({ name, value }) =>
    fc.constantFrom(...(DECLARED_ARGS[name].length > 0 ? DECLARED_ARGS[name] : ["x"])).map((arg) => ({
      name,
      args: { [arg]: value } as Record<string, unknown>,
    })),
  ),
  validCallArb.chain((call) =>
    fc
      .record({ key: fc.constantFrom(...(Object.keys(call.args).length > 0 ? Object.keys(call.args) : ["x"])), value: fc.jsonValue() })
      .map(({ key, value }) => ({ name: call.name, args: { ...call.args, [key]: value } })),
  ),
);

describe("robustness fuzz", () => {
  it("never returns INTERNAL_ERROR and never rejects for JSON arguments", async () => {
    await withConnection(async (connection) => {
      await fc.assert(
        fc.asyncProperty(argsArb, async ({ name, args }) => {
          const result = await connection.call(name, args);
          expect((result.structuredContent as { code?: unknown }).code).not.toBe("INTERNAL_ERROR");
        }),
        { seed: SEED, numRuns: NUM_RUNS, verbose: 1 },
      );
    });
  });
});
