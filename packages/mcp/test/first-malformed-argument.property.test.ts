// Feature: weave-mcp, Property 12: The first malformed argument is the one reported
// Validates: Requirements 3.5, 4.4, 7.4, 9.1, 9.2, 9.6, 9.7
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { DECLARED_ARGS, REQUIRED_ARGS, validCallArb } from "./arbitraries.js";
import type { ToolCall } from "./arbitraries.js";
import { spyEngine, withConnection } from "./harness.js";

const SEED = 1212;
const NUM_RUNS = 100;

type Corruption = { kind: "remove" } | { kind: "set"; value: unknown };

/** Values of the wrong JSON type for each argument name. */
const WRONG_TYPE: Readonly<Record<string, readonly unknown[]>> = {
  design: ["d", 3, true, {}],
  weaves: ["w", 3, false, []],
  profile: [3, true, [], 1.5],
  repeatAcross: ["true", 1, {}, []],
  plan: ["p", 3, true, []],
  cardSet: ["c", 3, false, []],
};

const caseArb = validCallArb
  .filter((call) => call.name !== "list_profiles")
  .chain((call) => {
    const declared = DECLARED_ARGS[call.name];
    const required = REQUIRED_ARGS[call.name];
    const corruptionFor = (name: string): fc.Arbitrary<Corruption> => {
      const options: fc.Arbitrary<Corruption>[] = [
        fc.constant<Corruption>({ kind: "set", value: null }),
        fc.constantFrom(...(WRONG_TYPE[name] ?? [])).map((value): Corruption => ({ kind: "set", value })),
      ];
      if (required.includes(name)) options.push(fc.constant<Corruption>({ kind: "remove" }));
      return fc.oneof(...options);
    };
    return fc
      .subarray([...declared], { minLength: 1 })
      .chain((names) =>
        fc.tuple(...names.map((name) => corruptionFor(name))).map((corruptions) => ({ call, names, corruptions })),
      );
  });

function apply(call: ToolCall, names: readonly string[], corruptions: readonly Corruption[]): Record<string, unknown> {
  const args = { ...call.args };
  names.forEach((name, i) => {
    const c = corruptions[i] as Corruption;
    if (c.kind === "remove") delete args[name];
    else args[name] = c.value;
  });
  return args;
}

describe("Feature: weave-mcp, Property 12: The first malformed argument is the one reported", () => {
  it("reports exactly the first corrupted argument in declaration order and calls no engine function", async () => {
    await fc.assert(
      fc.asyncProperty(caseArb, async ({ call, names, corruptions }) => {
        const args = apply(call, names, corruptions);
        const first = DECLARED_ARGS[call.name].find((name) => names.includes(name)) as string;
        const spy = spyEngine();
        await withConnection(async (connection) => {
          const result = await connection.call(call.name, args);
          expect(result.isError).toBe(true);
          const body = result.structuredContent as Record<string, unknown>;
          expect(Object.keys(body).sort()).toEqual(["argument", "code", "message"]);
          expect(body["code"]).toBe("ARGUMENT_INVALID");
          expect(body["argument"]).toBe(first);
          expect(typeof body["message"]).toBe("string");
          expect((body["message"] as string).length).toBeGreaterThan(0);
          expect(body["message"]).toContain(first);
        }, spy.engine);
        expect(spy.calls).toEqual([]);
      }),
      { seed: SEED, numRuns: NUM_RUNS, verbose: 1 },
    );
  });
});
