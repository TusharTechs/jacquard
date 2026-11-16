// Feature: weave-mcp, Property 13: Weave key handling
// Validates: Requirements 3.3, 3.4, 9.5
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { BuildInput } from "@jacquard/engine";
import { buildArgs, buildCaseArb, nonCanonicalKeyArb, weaveArb } from "./arbitraries.js";
import { spyEngine, withConnection } from "./harness.js";

const SEED = 1313;
const NUM_RUNS = 100;
const CANONICAL = /^(0|[1-9][0-9]*)$/;

describe("Feature: weave-mcp, Property 13: Weave key handling", () => {
  it("passes canonical keys to the engine with the same mapping, one entry per key", async () => {
    await fc.assert(
      fc.asyncProperty(
        buildCaseArb,
        fc.dictionary(fc.integer({ min: 0, max: 40 }).map(String), weaveArb, { maxKeys: 4 }),
        async (c, extra) => {
          const args = buildArgs(c);
          const weaves = { ...(args["weaves"] as Record<string, unknown>), ...extra };
          args["weaves"] = weaves;
          const spy = spyEngine();
          await withConnection(async (connection) => {
            await connection.call("build_lift_plan", args);
          }, spy.engine);
          const calls = spy.calls.filter((call) => call.fn === "buildLiftPlan");
          expect(calls).toHaveLength(1);
          const received = (calls[0]?.args[0] as BuildInput).weaves as Record<string, unknown>;
          expect(Object.keys(received).sort()).toEqual(Object.keys(weaves).sort());
          for (const key of Object.keys(weaves)) expect(received[key]).toEqual(weaves[key]);
        },
      ),
      { seed: SEED, numRuns: NUM_RUNS, verbose: 1 },
    );
  });

  it("rejects a non-canonical key as ARGUMENT_INVALID on weaves, quoting the first one, with no engine call", async () => {
    await fc.assert(
      fc.asyncProperty(
        buildCaseArb,
        fc.uniqueArray(nonCanonicalKeyArb.filter((k) => k !== "__proto__"), { minLength: 1, maxLength: 3 }),
        async (c, badKeys) => {
          const args = buildArgs(c);
          const weaves: Record<string, unknown> = { ...(args["weaves"] as Record<string, unknown>) };
          for (const key of badKeys) weaves[key] = { kind: "plain" };
          args["weaves"] = weaves;
          const firstBad = Object.keys(weaves).find((key) => !CANONICAL.test(key)) as string;
          const before = structuredClone(args);
          const spy = spyEngine();
          await withConnection(async (connection) => {
            const result = await connection.call("build_lift_plan", args);
            expect(result.isError).toBe(true);
            const body = result.structuredContent as { code: string; argument: string; message: string };
            expect(body.code).toBe("ARGUMENT_INVALID");
            expect(body.argument).toBe("weaves");
            expect(body.message).toContain("weaves");
            expect(body.message).toContain(`"${firstBad}"`);
          }, spy.engine);
          expect(spy.calls).toEqual([]);
          expect(args).toEqual(before);
        },
      ),
      { seed: SEED, numRuns: NUM_RUNS, verbose: 1 },
    );
  });
});
