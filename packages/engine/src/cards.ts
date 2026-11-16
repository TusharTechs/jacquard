// Card set builder (2.7 to 2.9). See design.md, "Cards", Positions and layout, Encoding.
// The card format is a configurable loom profile and has not been tested on a working loom.

import {
  cardIdleLifted,
  cardNumberDuplicate,
  cardNumberMissing,
  cardSizeMismatch,
  cardSpareLifted,
  cardsEmpty,
  type EngineResult,
} from "./errors.js";
import { validatePlan } from "./lift-plan.js";
import { err, ok } from "./result.js";
import type { Card, CardSet, LiftPlan, LoomProfile } from "./types.js";

/**
 * Encodes a lift plan as one card per pick, in pick order (2.7, 2.8). Runs `validatePlan` first and
 * returns its error. Position h is figuring hook h; spare hook s is position hookCount + s
 * [to verify placement]. `down` is the punched state that keeps a hook down, so figuring position h
 * is punched when `lifts[pick][h] !== down`, and spare and idle positions are punched when `down`.
 * The inputs are not modified.
 */
export function buildCards(plan: LiftPlan, profile: LoomProfile): EngineResult<CardSet> {
  const validated = validatePlan(plan, profile);
  if (!validated.ok) return err(validated.error);

  const down = profile.holeMeans === "noLift";
  const positionCount = plan.hookCount + profile.spareHookCount;

  const cards: Card[] = [];
  for (let pick = 0; pick < plan.pickCount; pick += 1) {
    const row = plan.lifts[pick] as readonly boolean[];
    const punched: boolean[] = [];
    for (let position = 0; position < positionCount; position += 1) {
      if (position < plan.hookCount) {
        punched.push((row[position] as boolean) !== down);
      } else {
        punched.push(down);
      }
    }
    cards.push({ index: pick, number: pick + 1, punched });
  }

  return ok({ designWidth: plan.designWidth, repeatAcross: plan.repeatAcross, cards });
}

/**
 * Decodes a card set back to a lift plan (2.10, 2.11, 2.13). Checks, in order: no cards
 * (`CARDS_EMPTY`); each card's size, in given order (`CARD_SIZE_MISMATCH`); the lowest duplicated
 * number; the lowest absent number in 1..cards.length. Cards are then ordered by number only
 * (`index` is ignored) and read as lift = punched XOR (holeMeans === "noLift"). The lowest card
 * and position with a lifted spare position gives `CARD_SPARE_LIFTED`, then a lifted idle position
 * gives `CARD_IDLE_LIFTED`. Last, the plan goes through `validatePlan`. The inputs are not modified.
 */
export function decodeCards(cardSet: CardSet, profile: LoomProfile): EngineResult<LiftPlan> {
  const cards = cardSet.cards;
  if (cards.length < 1) return err(cardsEmpty());

  const hookCount = profile.hookCount;
  const expected = hookCount + profile.spareHookCount;
  for (const card of cards) {
    if (card.punched.length !== expected) {
      return err(cardSizeMismatch(card.number, card.punched.length, expected));
    }
  }

  const seen = new Set<number>();
  let lowestDuplicate: number | undefined;
  for (const card of cards) {
    if (seen.has(card.number)) {
      if (lowestDuplicate === undefined || card.number < lowestDuplicate) {
        lowestDuplicate = card.number;
      }
    }
    seen.add(card.number);
  }
  if (lowestDuplicate !== undefined) return err(cardNumberDuplicate(lowestDuplicate));

  for (let number = 1; number <= cards.length; number += 1) {
    if (!seen.has(number)) return err(cardNumberMissing(number));
  }

  const down = profile.holeMeans === "noLift";
  const sorted = [...cards].sort((a, b) => a.number - b.number);
  const lifts: boolean[][] = sorted.map((card) =>
    card.punched.map((punched) => punched !== down),
  );

  for (let pick = 0; pick < sorted.length; pick += 1) {
    const row = lifts[pick] as boolean[];
    for (let position = hookCount; position < expected; position += 1) {
      if (row[position] === true) {
        return err(cardSpareLifted((sorted[pick] as Card).number, position));
      }
    }
  }

  if (!cardSet.repeatAcross) {
    const firstIdle = Math.max(0, cardSet.designWidth);
    for (let pick = 0; pick < sorted.length; pick += 1) {
      const row = lifts[pick] as boolean[];
      for (let position = firstIdle; position < hookCount; position += 1) {
        if (row[position] === true) {
          return err(cardIdleLifted((sorted[pick] as Card).number, position));
        }
      }
    }
  }

  const plan: LiftPlan = {
    pickCount: sorted.length,
    hookCount,
    designWidth: cardSet.designWidth,
    repeatAcross: cardSet.repeatAcross,
    lifts: lifts.map((row) => row.slice(0, hookCount)),
  };
  return validatePlan(plan, profile);
}

/**
 * Lays a card out in rows of `hooksPerCardRow` slots (2.8). Position q is at row
 * floor(q / hooksPerCardRow), slot q mod hooksPerCardRow. Slots past the last position are null.
 * Slot 0 is the top needle of a row [sourced, S1]; row 0 nearest the numbered end is [to verify].
 */
export function cardRows(card: Card, profile: LoomProfile): (boolean | null)[][] {
  const positionCount = card.punched.length;
  const slots = profile.hooksPerCardRow;
  const rowCount = Math.ceil(positionCount / slots);
  const rows: (boolean | null)[][] = [];
  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    const row: (boolean | null)[] = [];
    for (let slot = 0; slot < slots; slot += 1) {
      const position = rowIndex * slots + slot;
      row.push(position < positionCount ? (card.punched[position] as boolean) : null);
    }
    rows.push(row);
  }
  return rows;
}

/** Chain successor of card `index` in the endless lacing chain (2.9). */
export function nextCard(index: number, pickCount: number): number {
  return (index + 1) % pickCount;
}
