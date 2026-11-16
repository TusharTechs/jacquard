// Protocol-level example tests (1.5, 2.5, 5.3, 5.5, 5.6, 9.3, 9.4), through the in-memory client.
import { describe, expect, it } from "vitest";
import { PROFILE_120 } from "@jacquard/engine";
import { autofixFailedEngine, spyEngine, withConnection } from "./harness.js";

const PLAN = {
  pickCount: 2,
  hookCount: 120,
  designWidth: 2,
  repeatAcross: false,
  lifts: [
    [true, false, ...new Array(118).fill(false)],
    [false, true, ...new Array(118).fill(false)],
  ],
};

describe("protocol examples", () => {
  it("answers an unknown tool with TOOL_UNKNOWN naming it, then serves a valid call (1.5)", async () => {
    await withConnection(async (c) => {
      const unknown = await c.call("nope", {});
      expect(unknown.isError).toBe(true);
      expect(unknown.structuredContent).toMatchObject({ code: "TOOL_UNKNOWN" });
      expect((unknown.structuredContent as { message: string }).message).toContain("nope");
      const next = await c.call("list_profiles");
      expect(next.isError).not.toBe(true);
    });
  });

  it("serves list_profiles with no arguments field (2.5)", async () => {
    await withConnection(async (c) => {
      const result = await c.call("list_profiles");
      expect(result.isError).not.toBe(true);
      expect((result.structuredContent as { profiles: unknown[] }).profiles).toHaveLength(3);
    });
  });

  it("reports the first required argument when arguments are omitted", async () => {
    await withConnection(async (c) => {
      const result = await c.call("check_floats");
      expect(result.structuredContent).toEqual({
        code: "ARGUMENT_INVALID",
        argument: "plan",
        message: 'Missing required argument "plan".',
      });
    });
  });

  it("leaves an array as `arguments` to the SDK, which rejects it as invalid params, and keeps serving", async () => {
    await withConnection(async (c) => {
      await expect(
        c.client.callTool({ name: "check_floats", arguments: [] as unknown as Record<string, unknown> }),
      ).rejects.toThrow(/-32602|Invalid/i);
      const next = await c.call("list_profiles");
      expect(next.isError).not.toBe(true);
    });
  });

  it("rejects an extra auto_fix argument and calls autoFix with plan and profile only (5.5, 5.6)", async () => {
    const spy = spyEngine();
    await withConnection(async (c) => {
      const rejected = await c.call("auto_fix", { plan: PLAN, profile: "120", maxIterations: 3 });
      expect(rejected.structuredContent).toMatchObject({ code: "ARGUMENT_INVALID", argument: "maxIterations" });
      expect(spy.calls.filter((call) => call.fn === "autoFix")).toEqual([]);
      const ok = await c.call("auto_fix", { plan: PLAN, profile: "120" });
      expect(ok.isError).not.toBe(true);
      const autoFixCalls = spy.calls.filter((call) => call.fn === "autoFix");
      expect(autoFixCalls).toHaveLength(1);
      expect(autoFixCalls[0]?.args).toHaveLength(2);
      expect(autoFixCalls[0]?.args[1]).toBe(PROFILE_120);
    }, spy.engine);
  });

  it('lists the accepted names for profile "360" (9.3)', async () => {
    await withConnection(async (c) => {
      const result = await c.call("check_floats", { plan: PLAN, profile: "360" });
      const body = result.structuredContent as { code: string; argument: string; message: string };
      expect(body.code).toBe("ARGUMENT_INVALID");
      expect(body.argument).toBe("profile");
      for (const name of ['"120"', '"240"', '"400"']) expect(body.message).toContain(name);
    });
  });

  it("names profile.hookCount when a custom profile has none (9.4)", async () => {
    await withConnection(async (c) => {
      const result = await c.call("check_floats", { plan: PLAN, profile: { maxFloat: 3 } });
      const body = result.structuredContent as { argument: string; message: string };
      expect(body.argument).toBe("profile.hookCount");
      expect(body.message).toContain("profile.hookCount");
    });
  });

  it("preserves reason, maxIterations and remaining from AUTOFIX_FAILED (5.3)", async () => {
    await withConnection(async (c) => {
      const result = await c.call("auto_fix", { plan: PLAN, profile: "120" });
      expect(result.isError).toBe(true);
      const body = result.structuredContent as Record<string, unknown>;
      expect(body["code"]).toBe("AUTOFIX_FAILED");
      expect(body["reason"]).toBe("iterationLimit");
      expect(body["maxIterations"]).toBe(17);
      expect(Array.isArray(body["remaining"])).toBe(true);
      expect(result).not.toHaveProperty("structuredContent.plan");
    }, autofixFailedEngine("iterationLimit", 17));
  });

  it("labels PROFILE_400.cardFillOrder [to verify] in list_profiles (2.3)", async () => {
    await withConnection(async (c) => {
      const result = await c.call("list_profiles");
      const profiles = (result.structuredContent as {
        profiles: { name: string; fields: Record<string, { label: string }> }[];
      }).profiles;
      expect(profiles[2]?.name).toBe("400");
      expect(profiles[2]?.fields["cardFillOrder"]?.label).toBe("[to verify]");
    });
  });
});
