// The 3D loom's model (studio-experience Requirement 9). Pure and deterministic, with no weaving
// rule of its own: the cards come from the engine's buildCards, the hooks each card lifts are read
// back through the engine's decodeCards (so "a hole lifts" or "a hole keeps down" stays in the
// engine), and the cloth colours come from the export package's clothModel. This file only adds
// time: which card is on the cylinder, how far each hook has risen, and how many picks are woven.
import { buildCards, decodeCards, err, nextCard, ok } from "@jacquard/engine";
import type { Card, EngineError, LiftPlan, LoomProfile, Result } from "@jacquard/engine";
import { clothModel } from "@jacquard/export";
import type { ClothCell, ExportError, YarnColours } from "@jacquard/export";

/** Where each Phase of one pick ends, as a fraction of the pick (Decision log). */
export const PHASE_ENDS = { advance: 0.2, lift: 0.35, shuttle: 0.7, beat: 0.85 } as const;

export type PhaseName = "advance" | "lift" | "shuttle" | "beat" | "settle";
export const PHASE_ORDER: readonly PhaseName[] = ["advance", "lift", "shuttle", "beat", "settle"];

export interface LoomModel {
  readonly pickCount: number;
  readonly hookCount: number;
  /** Card positions: figuring hooks, then spare hooks. */
  readonly positionCount: number;
  readonly profile: LoomProfile;
  /** One card per pick, in lacing order (engine buildCards). */
  readonly cards: readonly Card[];
  /** lifted[card][hook]: the figuring hooks that card lifts, read back through decodeCards. */
  readonly lifted: readonly (readonly boolean[])[];
  /** cloth[pick][hook]: the face of the cloth (export clothModel). */
  readonly cloth: readonly (readonly ClothCell[])[];
}

export interface LoomFrame {
  /** The pick being woven, 0-based; the card on the cylinder weaves it. */
  readonly pick: number;
  /** That card's number in lacing order, pick + 1. */
  readonly cardNumber: number;
  readonly phase: PhaseName;
  /** Progress through the current Phase, 0 to 1. */
  readonly progress: number;
  /** How far the lifted hooks have risen, 0 to 1. */
  readonly rise: number;
  /** Picks already beaten into the cloth. */
  readonly woven: number;
  /** Shuttle position across the shed, -1 (left) to 1 (right); travels each pick in turn. */
  readonly shuttle: number;
  /** Reed swing towards the cloth, 0 to 1. */
  readonly reed: number;
  /** Card chain advance, 0 to 1 (a quarter turn of the cylinder). */
  readonly advance: number;
}

export function buildLoomModel(
  plan: LiftPlan,
  profile: LoomProfile,
  yarns: YarnColours,
): Result<LoomModel, EngineError | ExportError> {
  const built = buildCards(plan, profile);
  if (!built.ok) return err(built.error);
  const cloth = clothModel(plan, profile, yarns, "face");
  if (!cloth.ok) return err(cloth.error);
  const lifted: boolean[][] = [];
  for (const card of built.value.cards) {
    const one = decodeCards(
      { designWidth: built.value.designWidth, repeatAcross: built.value.repeatAcross, cards: [{ ...card, index: 0, number: 1 }] },
      profile,
    );
    if (!one.ok) return err(one.error);
    lifted.push([...(one.value.lifts[0] ?? [])]);
  }
  return ok({
    pickCount: plan.pickCount,
    hookCount: plan.hookCount,
    positionCount: plan.hookCount + profile.spareHookCount,
    profile,
    cards: built.value.cards,
    lifted,
    cloth: cloth.value,
  });
}

/** Smooth start and stop, 0 to 1. */
function ease(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}

function clampTime(model: LoomModel, t: number): number {
  if (!Number.isFinite(t)) return t === Number.POSITIVE_INFINITY ? model.pickCount : 0;
  return Math.min(model.pickCount, Math.max(0, t));
}

export function loomFrame(model: LoomModel, t: number): LoomFrame {
  const time = clampTime(model, t);
  const last = Math.max(0, model.pickCount - 1);
  const pick = Math.min(Math.floor(time), last);
  // At t = pickCount the last pick is complete: the end of its settle Phase.
  const fraction = time >= model.pickCount ? 1 : time - Math.floor(time);
  let phase: PhaseName;
  let start: number;
  let end: number;
  if (fraction < PHASE_ENDS.advance) [phase, start, end] = ["advance", 0, PHASE_ENDS.advance];
  else if (fraction < PHASE_ENDS.lift) [phase, start, end] = ["lift", PHASE_ENDS.advance, PHASE_ENDS.lift];
  else if (fraction < PHASE_ENDS.shuttle) [phase, start, end] = ["shuttle", PHASE_ENDS.lift, PHASE_ENDS.shuttle];
  else if (fraction < PHASE_ENDS.beat) [phase, start, end] = ["beat", PHASE_ENDS.shuttle, PHASE_ENDS.beat];
  else [phase, start, end] = ["settle", PHASE_ENDS.beat, 1];
  const progress = Math.min(1, Math.max(0, (fraction - start) / (end - start)));
  let rise = 0;
  if (phase === "lift") rise = ease(progress);
  else if (phase === "shuttle" || phase === "beat") rise = 1;
  else if (phase === "settle") rise = 1 - ease(progress);
  const woven = model.pickCount === 0 ? 0 : fraction >= PHASE_ENDS.beat ? pick + 1 : pick;
  const direction = pick % 2 === 0 ? 1 : -1;
  const across = phase === "shuttle" ? -1 + 2 * ease(progress) : phase === "advance" || phase === "lift" ? -1 : 1;
  const reed = phase === "beat" ? Math.sin(progress * Math.PI) : 0;
  const advance = phase === "advance" ? ease(progress) : 1;
  return { pick, cardNumber: pick + 1, phase, progress, rise, woven, shuttle: across * direction, reed, advance };
}

/** Height of card position `position` (hook or spare) in a frame: 0 unless the current card lifts it. */
export function hookHeight(model: LoomModel, frame: LoomFrame, position: number): number {
  if (position < 0 || position >= model.hookCount) return 0;
  return model.lifted[frame.pick]?.[position] === true ? frame.rise : 0;
}

/** Positions with a height above 0. */
export function raisedPositions(model: LoomModel, frame: LoomFrame): number[] {
  const raised: number[] = [];
  for (let position = 0; position < model.positionCount; position += 1) {
    if (hookHeight(model, frame, position) > 0) raised.push(position);
  }
  return raised;
}

/** How many hooks the card for `pick` lifts. */
export function liftedCount(model: LoomModel, pick: number): number {
  let count = 0;
  for (const lifted of model.lifted[pick] ?? []) if (lifted) count += 1;
  return count;
}

function hexBytes(colour: string): [number, number, number] {
  const value = parseInt(colour.slice(1, 7), 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

/**
 * RGBA texels of the cloth, `hookCount` wide and `pickCount` high, row r = pick r. Woven picks
 * (below `woven`) carry clothModel's colour at full alpha; the rest are transparent. Writes into
 * `target` when given (same size), so the 3D view can reuse one buffer.
 */
export function clothTexture(model: LoomModel, woven: number, target?: Uint8Array): Uint8Array {
  const size = model.hookCount * model.pickCount * 4;
  const data = target !== undefined && target.length === size ? target : new Uint8Array(size);
  const shown = Math.min(model.pickCount, Math.max(0, Math.floor(woven)));
  for (let pick = 0; pick < model.pickCount; pick += 1) {
    const row = model.cloth[pick] ?? [];
    for (let hook = 0; hook < model.hookCount; hook += 1) {
      const offset = (pick * model.hookCount + hook) * 4;
      if (pick < shown) {
        const [r, g, b] = hexBytes(row[hook]?.colour ?? "#000000");
        data[offset] = r;
        data[offset + 1] = g;
        data[offset + 2] = b;
        data[offset + 3] = 255;
      } else {
        data[offset] = 0;
        data[offset + 1] = 0;
        data[offset + 2] = 0;
        data[offset + 3] = 0;
      }
    }
  }
  return data;
}

/**
 * Card indices around `pick` in lacing order: `before` cards before it, then it, then `after`
 * cards, each the engine's nextCard of the one before, wrapping round; never more than pickCount.
 */
export function cardStrip(pickCount: number, pick: number, before: number, after: number): number[] {
  if (pickCount <= 0) return [];
  const total = Math.min(pickCount, Math.max(0, Math.floor(before)) + 1 + Math.max(0, Math.floor(after)));
  const lead = Math.min(Math.max(0, Math.floor(before)), total - 1);
  const current = ((Math.floor(pick) % pickCount) + pickCount) % pickCount;
  let index = (((current - lead) % pickCount) + pickCount) % pickCount;
  const strip: number[] = [];
  for (let step = 0; step < total; step += 1) {
    strip.push(index);
    index = nextCard(index, pickCount);
  }
  return strip;
}
