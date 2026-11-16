// Example test for the 400-hook card layout (task 9.3). Requirements 1.3, 2.8.
// S1: "A needle board or plate for a 400-machine, has 416 holes, arranged in 52 rows with 8 holes
// in a row." The card format has not been tested on a working loom.

import { describe, expect, it } from "vitest";

import { buildCards, cardRows } from "../src/cards.js";
import { buildLiftPlan } from "../src/lift-plan.js";
import { PROFILE_400 } from "../src/profiles.js";
import type { Design, WeaveAssignment } from "../src/types.js";

describe("400-hook card layout (1.3, 2.8)", () => {
  it("lays each card out as 416 positions in 52 rows of 8, spares never punched", () => {
    expect(PROFILE_400.holeMeans).toBe("lift");

    const pickCount = 4;
    const design: Design = Array.from({ length: pickCount }, () =>
      Array.from({ length: PROFILE_400.hookCount }, () => 0),
    );
    const weaves: WeaveAssignment = { 0: { kind: "plain" } };

    const built = buildLiftPlan({ design, weaves, profile: PROFILE_400 });
    expect(built.ok).toBe(true);
    if (!built.ok) return;

    const cards = buildCards(built.value.plan, PROFILE_400);
    expect(cards.ok).toBe(true);
    if (!cards.ok) return;
    expect(cards.value.cards).toHaveLength(pickCount);

    for (const card of cards.value.cards) {
      expect(card.punched).toHaveLength(416);

      const rows = cardRows(card, PROFILE_400);
      expect(rows).toHaveLength(52);
      for (const row of rows) {
        expect(row).toHaveLength(8);
        expect(row.every((slot) => slot !== null)).toBe(true);
      }

      for (let position = 400; position < 416; position += 1) {
        expect(card.punched[position]).toBe(false);
      }
      // Sanity: the figuring positions are punched somewhere, so the check above is not vacuous.
      expect(card.punched.slice(0, 400).some((punched) => punched)).toBe(true);
    }
  });
});
