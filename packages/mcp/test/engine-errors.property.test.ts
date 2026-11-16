// Feature: weave-mcp, Property 10: Engine errors come back unchanged
// Validates: Requirements 3.6, 4.3, 5.4, 6.5, 7.2, 7.3, 8.1, 8.6, 9.8, 10.2
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  autoFix,
  buildCards,
  buildLiftPlan,
  checkFloats,
  decodeCards,
  defineProfile,
  validateProfile,
  PROFILE_120,
  PROFILE_240,
  PROFILE_400,
} from "@jacquard/engine";
import type { CardSet, Design, EngineError, LiftPlan, LoomProfile, ProfileFields, WeaveAssignment } from "@jacquard/engine";
import { canonicalJson } from "../src/canonical-json.js";
import { engineErrorCallArb, planCaseArb } from "./arbitraries.js";
import type { ToolCall } from "./arbitraries.js";
import { TOOL_OPERATIONS, autofixFailedEngine, spyEngine, withConnection } from "./harness.js";

const SEED = 1010;
const NUM_RUNS = 100;

function resolve(argument: unknown): { ok: true; profile: LoomProfile } | { ok: false; error: EngineError } {
  if (argument === "120") return { ok: true, profile: PROFILE_120 };
  if (argument === "240") return { ok: true, profile: PROFILE_240 };
  if (argument === "400") return { ok: true, profile: PROFILE_400 };
  const v = validateProfile(defineProfile(argument as ProfileFields));
  return v.ok ? { ok: true, profile: v.value } : { ok: false, error: v.error };
}

/** The engine error a direct call gives, or undefined when the engine accepts the input. */
function directError(call: ToolCall): EngineError | undefined {
  const resolved = resolve(call.args["profile"]);
  if (!resolved.ok) return resolved.error;
  const profile = resolved.profile;
  const a = call.args;
  const r =
    call.name === "build_lift_plan"
      ? buildLiftPlan({
          design: a["design"] as Design,
          weaves: a["weaves"] as WeaveAssignment,
          profile,
          repeatAcross: (a["repeatAcross"] as boolean | undefined) ?? false,
        })
      : call.name === "check_floats"
        ? checkFloats(a["plan"] as LiftPlan, profile)
        : call.name === "auto_fix"
          ? autoFix(a["plan"] as LiftPlan, profile)
          : call.name === "build_cards"
            ? buildCards(a["plan"] as LiftPlan, profile)
            : decodeCards(a["cardSet"] as CardSet, profile);
  return r.ok ? undefined : r.error;
}

const RESULT_KEYS = ["plan", "violations", "cardSet", "cardRows", "flips", "idleHooks", "warnings"];

describe("Feature: weave-mcp, Property 10: Engine errors come back unchanged", () => {
  it("returns the engine error with every field unchanged and no result", async () => {
    let checked = 0;
    await fc.assert(
      fc.asyncProperty(engineErrorCallArb, async (call) => {
        const expected = directError(call);
        // Every corruption is designed to fail; a pass here would mean a broken generator.
        expect(expected, `corruption for ${call.name} did not fail in the engine`).toBeDefined();
        const spy = spyEngine();
        await withConnection(async (connection) => {
          const result = await connection.call(call.name, call.args);
          expect(result.isError).toBe(true);
          const body = result.structuredContent as Record<string, unknown>;
          expect(canonicalJson(body)).toBe(canonicalJson(expected));
          expect(body["code"]).not.toBe("ARGUMENT_INVALID");
          for (const key of RESULT_KEYS) expect(body).not.toHaveProperty(key);
          if ((expected as EngineError).code === "PROFILE_INVALID") {
            const ran = spy.calls.filter((c) => (TOOL_OPERATIONS[call.name] ?? []).includes(c.fn));
            expect(ran).toEqual([]);
          }
        }, spy.engine);
        checked += 1;
      }),
      { seed: SEED, numRuns: NUM_RUNS, verbose: 1 },
    );
    expect(checked).toBe(NUM_RUNS);
  });

  it("returns AUTOFIX_FAILED with reason, maxIterations and remaining preserved (5.3)", async () => {
    await fc.assert(
      fc.asyncProperty(
        planCaseArb,
        fc.constantFrom("stuck" as const, "iterationLimit" as const),
        fc.integer({ min: 0, max: 1000 }),
        async ({ plan, profileCase }, reason, maxIterations) => {
          const engine = autofixFailedEngine(reason, maxIterations);
          const expected = engine.autoFix(plan, profileCase.profile);
          await withConnection(async (connection) => {
            const result = await connection.call("auto_fix", { plan, profile: profileCase.argument });
            expect(result.isError).toBe(true);
            expect(expected.ok).toBe(false);
            if (!expected.ok) {
              expect(canonicalJson(result.structuredContent)).toBe(canonicalJson(expected.error));
            }
            expect(result.structuredContent).not.toHaveProperty("plan");
          }, engine);
        },
      ),
      { seed: SEED, numRuns: NUM_RUNS, verbose: 1 },
    );
  });
});
