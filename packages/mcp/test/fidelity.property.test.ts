// Feature: weave-mcp, Property 7: Fidelity to the engine
// Validates: Requirements 3.1, 3.2, 4.1, 4.2, 5.1, 5.2, 6.1, 7.1, 10.1, 10.4
// The model calls the public engine functions directly and compares Canonical_JSON of both sides.
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  autoFix,
  buildCards,
  buildLiftPlan,
  cardRows,
  checkFloats,
  decodeCards,
} from "@jacquard/engine";
import type { Design } from "@jacquard/engine";
import { canonicalJson } from "../src/canonical-json.js";
import { buildArgs, buildCaseArb, cardCaseArb, planCaseArb } from "./arbitraries.js";
import type { BuildCase, CardCase, PlanCase } from "./arbitraries.js";
import { withConnection } from "./harness.js";
import type { Connection } from "./harness.js";

const SEED = 7007;
const NUM_RUNS = 300;

type Case =
  | { kind: "build"; c: BuildCase }
  | { kind: "plan"; tool: "check_floats" | "auto_fix" | "build_cards"; c: PlanCase }
  | { kind: "decode"; c: CardCase };

const caseArb: fc.Arbitrary<Case> = fc.oneof(
  buildCaseArb.map((c): Case => ({ kind: "build", c })),
  fc
    .record({ c: planCaseArb, tool: fc.constantFrom("check_floats" as const, "auto_fix" as const, "build_cards" as const) })
    .map(({ c, tool }): Case => ({ kind: "plan", tool, c })),
  cardCaseArb.map((c): Case => ({ kind: "decode", c })),
);

/** The direct engine output in the tool's wrapper, or the engine error. */
function model(test: Case): { error: boolean; body: unknown } {
  switch (test.kind) {
    case "build": {
      const r = buildLiftPlan({
        design: test.c.design as Design,
        weaves: test.c.weaves,
        profile: test.c.profileCase.profile,
        repeatAcross: test.c.repeatAcross ?? false,
      });
      return r.ok ? { error: false, body: r.value } : { error: true, body: r.error };
    }
    case "plan": {
      const { plan, profileCase } = test.c;
      const profile = profileCase.profile;
      if (test.tool === "check_floats") {
        const r = checkFloats(plan, profile);
        return r.ok ? { error: false, body: { violations: r.value } } : { error: true, body: r.error };
      }
      if (test.tool === "auto_fix") {
        const r = autoFix(plan, profile);
        return r.ok ? { error: false, body: r.value } : { error: true, body: r.error };
      }
      const r = buildCards(plan, profile);
      return r.ok
        ? { error: false, body: { cardSet: r.value, cardRows: r.value.cards.map((card) => cardRows(card, profile)) } }
        : { error: true, body: r.error };
    }
    case "decode": {
      const r = decodeCards(test.c.cardSet, test.c.profileCase.profile);
      return r.ok ? { error: false, body: { plan: r.value } } : { error: true, body: r.error };
    }
  }
}

async function callServer(connection: Connection, test: Case) {
  switch (test.kind) {
    case "build":
      return connection.call("build_lift_plan", buildArgs(test.c));
    case "plan":
      return connection.call(test.tool, { plan: test.c.plan, profile: test.c.profileCase.argument });
    case "decode":
      return connection.call("decode_cards", { cardSet: test.c.cardSet, profile: test.c.profileCase.argument });
  }
}

describe("Feature: weave-mcp, Property 7: Fidelity to the engine", () => {
  it("returns exactly the engine output in the tool's wrapper", async () => {
    await withConnection(async (connection) => {
      await fc.assert(
        fc.asyncProperty(caseArb, async (test) => {
          const expected = model(test);
          const result = await callServer(connection, test);
          expect(result.isError === true).toBe(expected.error);
          expect(canonicalJson(result.structuredContent)).toBe(canonicalJson(expected.body));
        }),
        { seed: SEED, numRuns: NUM_RUNS, verbose: 1 },
      );
    });
  });

  it("treats an omitted repeatAcross as false (3.2)", async () => {
    await withConnection(async (connection) => {
      await fc.assert(
        fc.asyncProperty(buildCaseArb, async (c) => {
          const omitted = buildArgs({ ...c, repeatAcross: undefined });
          const explicit = { ...omitted, repeatAcross: false };
          const a = await connection.call("build_lift_plan", omitted);
          const b = await connection.call("build_lift_plan", explicit);
          expect(canonicalJson(a.structuredContent)).toBe(canonicalJson(b.structuredContent));
        }),
        { seed: SEED, numRuns: 100, verbose: 1 },
      );
    });
  });
});
