// Feature: weave-mcp, Property 9: Round trip through the server
// Validates: Requirements 7.5
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { planCaseArb } from "./arbitraries.js";
import { withConnection } from "./harness.js";

const SEED = 9009;
const NUM_RUNS = 100;

describe("Feature: weave-mcp, Property 9: Round trip through the server", () => {
  it("decode_cards(build_cards(plan)) equals the plan", async () => {
    await withConnection(async (connection) => {
      await fc.assert(
        fc.asyncProperty(planCaseArb, async ({ plan, profileCase }) => {
          const built = await connection.call("build_cards", { plan, profile: profileCase.argument });
          expect(built.isError).not.toBe(true);
          const { cardSet } = built.structuredContent as { cardSet: unknown };
          const decoded = await connection.call("decode_cards", { cardSet, profile: profileCase.argument });
          expect(decoded.isError).not.toBe(true);
          expect((decoded.structuredContent as { plan: unknown }).plan).toEqual(plan);
        }),
        { seed: SEED, numRuns: NUM_RUNS, verbose: 1 },
      );
    });
  });
});
