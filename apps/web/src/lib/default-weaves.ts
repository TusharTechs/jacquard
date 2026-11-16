// Default weave per region and the weaves the UI offers (10.5). Plain data only: the engine
// validates and evaluates every weave.
import type { Weave, WeaveAssignment } from "@jacquard/engine";

/** Regions 1 to 7 cycle through these, in this order (Decision log, default weaves) [decision]. */
const CYCLE: readonly Weave[] = [
  { kind: "twill", up: 1, down: 3, direction: "Z" },
  { kind: "satin", size: 5, move: 2, facing: "weft" },
  { kind: "twill", up: 3, down: 1, direction: "S" },
  { kind: "satin", size: 8, move: 3, facing: "warp" },
];

const PLAIN: Weave = { kind: "plain" };

/** Weaves for every region a profile can have (the engine's maximum region limit is 8). */
export const WEAVE_SLOTS = 8;

/** Region 0 plain; regions 1 and up cycle through CYCLE. */
export function defaultWeaves(regionCount: number): WeaveAssignment {
  const count = Number.isFinite(regionCount) ? Math.max(0, Math.floor(regionCount)) : 0;
  const weaves: Record<number, Weave> = {};
  for (let region = 0; region < count; region += 1) {
    weaves[region] = region === 0 ? PLAIN : CYCLE[(region - 1) % CYCLE.length]!;
  }
  return weaves;
}

export interface WeaveChoice {
  readonly id: string;
  readonly label: string;
  readonly weave: Weave;
}

/** The fixed list of weaves the UI offers [decision]. */
export const WEAVE_CHOICES: readonly WeaveChoice[] = [
  { id: "plain", label: "Plain", weave: { kind: "plain" } },
  { id: "twill-1-3-z", label: "Twill 1/3 Z", weave: { kind: "twill", up: 1, down: 3, direction: "Z" } },
  { id: "twill-3-1-s", label: "Twill 3/1 S", weave: { kind: "twill", up: 3, down: 1, direction: "S" } },
  { id: "twill-2-2-z", label: "Twill 2/2 Z", weave: { kind: "twill", up: 2, down: 2, direction: "Z" } },
  { id: "satin-5-2-weft", label: "Satin 5, move 2, weft-faced", weave: { kind: "satin", size: 5, move: 2, facing: "weft" } },
  { id: "satin-5-3-warp", label: "Satin 5, move 3, warp-faced", weave: { kind: "satin", size: 5, move: 3, facing: "warp" } },
  { id: "satin-8-3-warp", label: "Satin 8, move 3, warp-faced", weave: { kind: "satin", size: 8, move: 3, facing: "warp" } },
  { id: "satin-8-5-weft", label: "Satin 8, move 5, weft-faced", weave: { kind: "satin", size: 8, move: 5, facing: "weft" } },
];

function sameWeave(a: Weave, b: Weave): boolean {
  if (a.kind === "plain" || b.kind === "plain") return a.kind === b.kind;
  if (a.kind === "twill" && b.kind === "twill") return a.up === b.up && a.down === b.down && a.direction === b.direction;
  if (a.kind === "satin" && b.kind === "satin") return a.size === b.size && a.move === b.move && a.facing === b.facing;
  return false;
}

/** The choice that matches a weave, for showing the current selection; undefined if none. */
export function weaveChoiceOf(weave: Weave): WeaveChoice | undefined {
  return WEAVE_CHOICES.find((choice) => sameWeave(choice.weave, weave));
}
