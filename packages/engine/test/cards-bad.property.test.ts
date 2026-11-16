// Property 15: Bad card sets are rejected.
// Feature: weave-engine, Property 15: Bad card sets are rejected
// **Validates: Requirements 2.11, 2.13**

import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

import { buildCards, decodeCards } from "../src/index.js";
import type { Card, CardSet } from "../src/types.js";

import { liftPlanArb, liftPlanFromDesignArb, type PlanCase } from "./arbitraries.js";

const planCaseArb: fc.Arbitrary<PlanCase> = fc.oneof(liftPlanArb(), liftPlanFromDesignArb());

/** The card set for a valid plan. The generators only make valid plans, so a failure here is a bug. */
function cardsOf({ plan, profile }: PlanCase): CardSet {
  const built = buildCards(plan, profile);
  if (!built.ok) throw new Error(`buildCards rejected a valid plan: ${built.error.code}`);
  return built.value;
}

function withCards(set: CardSet, cards: readonly Card[]): CardSet {
  return { ...set, cards };
}

function flip(card: Card, position: number): Card {
  return { ...card, punched: card.punched.map((bit, at) => (at === position ? !bit : bit)) };
}

/** Sets `position` of a card to the lifted state: punched is lift XOR (holeMeans === "noLift"). */
function liftedAt(card: Card, position: number, down: boolean): Card {
  return { ...card, punched: card.punched.map((bit, at) => (at === position ? !down : bit)) };
}

function replaceAt<T>(items: readonly T[], at: number, item: T): T[] {
  return items.map((existing, index) => (index === at ? item : existing));
}

const RUNS = { numRuns: 300 };

describe("Property 15: Bad card sets are rejected (2.11, 2.13)", () => {
  it("removing a card that is not the last gives CARD_NUMBER_MISSING with that number", () => {
    fc.assert(
      fc.property(
        planCaseArb.filter(({ plan }) => plan.pickCount >= 2),
        fc.nat(),
        (planCase, choice) => {
          const set = cardsOf(planCase);
          const at = choice % (set.cards.length - 1); // never the last card
          const removed = set.cards.filter((_, index) => index !== at);
          const result = decodeCards(withCards(set, removed), planCase.profile);
          expect(result.ok).toBe(false);
          if (result.ok) return;
          expect(result.error.code).toBe("CARD_NUMBER_MISSING");
          if (result.error.code === "CARD_NUMBER_MISSING") {
            expect(result.error.number).toBe(at + 1);
          }
        },
      ),
      RUNS,
    );
  });

  it("duplicating a card gives CARD_NUMBER_DUPLICATE with that number", () => {
    fc.assert(
      fc.property(planCaseArb, fc.nat(), (planCase, choice) => {
        const set = cardsOf(planCase);
        const at = choice % set.cards.length;
        const result = decodeCards(
          withCards(set, [...set.cards, set.cards[at] as Card]),
          planCase.profile,
        );
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.code).toBe("CARD_NUMBER_DUPLICATE");
        if (result.error.code === "CARD_NUMBER_DUPLICATE") {
          expect(result.error.number).toBe(at + 1);
        }
      }),
      RUNS,
    );
  });

  it("changing a card's length gives CARD_SIZE_MISMATCH with its number and sizes", () => {
    fc.assert(
      fc.property(planCaseArb, fc.nat(), fc.boolean(), (planCase, choice, shorter) => {
        const set = cardsOf(planCase);
        const at = choice % set.cards.length;
        const card = set.cards[at] as Card;
        const expected = planCase.profile.hookCount + planCase.profile.spareHookCount;
        const punched = shorter ? card.punched.slice(0, -1) : [...card.punched, false];
        const result = decodeCards(
          withCards(set, replaceAt(set.cards, at, { ...card, punched })),
          planCase.profile,
        );
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.code).toBe("CARD_SIZE_MISMATCH");
        if (result.error.code === "CARD_SIZE_MISMATCH") {
          expect(result.error.number).toBe(at + 1);
          expect(result.error.positionCount).toBe(punched.length);
          expect(result.error.expected).toBe(expected);
        }
      }),
      RUNS,
    );
  });

  it("lifting a spare position gives CARD_SPARE_LIFTED with the card number and position", () => {
    fc.assert(
      fc.property(
        planCaseArb.filter(({ profile }) => profile.spareHookCount >= 1),
        fc.nat(),
        fc.nat(),
        ({ plan, profile, repeatAcross }, choice, spareChoice) => {
          const set = cardsOf({ plan, profile, repeatAcross });
          const at = choice % set.cards.length;
          const position = profile.hookCount + (spareChoice % profile.spareHookCount);
          const bad = liftedAt(set.cards[at] as Card, position, profile.holeMeans === "noLift");
          const result = decodeCards(withCards(set, replaceAt(set.cards, at, bad)), profile);
          expect(result.ok).toBe(false);
          if (result.ok) return;
          expect(result.error.code).toBe("CARD_SPARE_LIFTED");
          if (result.error.code === "CARD_SPARE_LIFTED") {
            expect(result.error.number).toBe(at + 1);
            expect(result.error.position).toBe(position);
          }
        },
      ),
      RUNS,
    );
  });

  it("lifting an idle position gives CARD_IDLE_LIFTED with the card number and position", () => {
    fc.assert(
      fc.property(
        planCaseArb.filter(({ plan }) => !plan.repeatAcross && plan.designWidth < plan.hookCount),
        fc.nat(),
        fc.nat(),
        (planCase, choice, idleChoice) => {
          const { plan, profile } = planCase;
          const set = cardsOf(planCase);
          const at = choice % set.cards.length;
          const idleCount = plan.hookCount - plan.designWidth;
          const position = plan.designWidth + (idleChoice % idleCount);
          const bad = liftedAt(set.cards[at] as Card, position, profile.holeMeans === "noLift");
          const result = decodeCards(withCards(set, replaceAt(set.cards, at, bad)), profile);
          expect(result.ok).toBe(false);
          if (result.ok) return;
          expect(result.error.code).toBe("CARD_IDLE_LIFTED");
          if (result.error.code === "CARD_IDLE_LIFTED") {
            expect(result.error.number).toBe(at + 1);
            expect(result.error.position).toBe(position);
          }
        },
      ),
      RUNS,
    );
  });

  it("an empty card set gives CARDS_EMPTY", () => {
    fc.assert(
      fc.property(planCaseArb, (planCase) => {
        const result = decodeCards(withCards(cardsOf(planCase), []), planCase.profile);
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.code).toBe("CARDS_EMPTY");
      }),
      RUNS,
    );
  });

  it("a repeat-across card set whose tiles differ gives PLAN_INVALID notPeriodic at that pick and hook (2.13)", () => {
    fc.assert(
      fc.property(
        planCaseArb.filter(({ plan }) => plan.repeatAcross && plan.designWidth < plan.hookCount),
        fc.nat(),
        fc.nat(),
        (planCase, choice, hookChoice) => {
          const { plan, profile } = planCase;
          const set = cardsOf(planCase);
          const at = choice % set.cards.length;
          const position = plan.designWidth + (hookChoice % (plan.hookCount - plan.designWidth));
          const bad = flip(set.cards[at] as Card, position);
          const result = decodeCards(withCards(set, replaceAt(set.cards, at, bad)), profile);
          expect(result.ok).toBe(false);
          if (result.ok) return;
          expect(result.error.code).toBe("PLAN_INVALID");
          if (result.error.code === "PLAN_INVALID") {
            expect(result.error.problem).toBe("notPeriodic");
            expect(result.error.pick).toBe(at);
            expect(result.error.hook).toBe(position);
          }
        },
      ),
      RUNS,
    );
  });
});
