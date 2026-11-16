// Feature: weave-mcp, Property 8: build_cards numbering
// Validates: Requirements 6.2, 6.3
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { CardSet } from "@jacquard/engine";
import { planCaseArb } from "./arbitraries.js";
import { withConnection } from "./harness.js";

const SEED = 8008;
const NUM_RUNS = 100;

describe("Feature: weave-mcp, Property 8: build_cards numbering", () => {
  it("returns one card per pick, numbered 1..pickCount in pick order, with one cardRows entry per card", async () => {
    await withConnection(async (connection) => {
      await fc.assert(
        fc.asyncProperty(planCaseArb, async ({ plan, profileCase }) => {
          const result = await connection.call("build_cards", { plan, profile: profileCase.argument });
          expect(result.isError).not.toBe(true);
          const { cardSet, cardRows } = result.structuredContent as { cardSet: CardSet; cardRows: unknown[] };
          expect(cardSet.cards).toHaveLength(plan.pickCount);
          expect(cardRows).toHaveLength(cardSet.cards.length);
          const down = profileCase.profile.holeMeans === "noLift";
          cardSet.cards.forEach((card, i) => {
            expect(card.index).toBe(i);
            expect(card.number).toBe(i + 1);
            const lifts = plan.lifts[i] as readonly boolean[];
            // Card i corresponds to pick i: its figuring positions encode that pick's lifts.
            lifts.forEach((lift, hook) => {
              expect(card.punched[hook]).toBe(lift !== down);
            });
            const rows = cardRows[i] as (boolean | null)[][];
            expect(rows.flat().filter((slot) => slot !== null)).toEqual([...card.punched]);
          });
        }),
        { seed: SEED, numRuns: NUM_RUNS, verbose: 1 },
      );
    });
  });
});
