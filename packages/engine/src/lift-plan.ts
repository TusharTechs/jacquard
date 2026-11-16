// Lift plan builder (2.1 to 2.6). See design.md, "Components and Interfaces", Lift plan builder.
// Seam warnings (2.12) are added by a later task; `warnings` is empty for now.

import type { EngineResult } from "./errors.js";
import { err, ok } from "./result.js";
import { validateInput } from "./validate.js";
import { evaluateWeave } from "./weaves.js";
import type { BuildInput, BuildOutput, LiftPlan, Weave } from "./types.js";

/**
 * Builds the lift plan from a design. Runs `validateInput` first and returns its first error.
 * Each cell in the design width comes from its own region's weave, anchored at the design origin
 * (2.2). Hooks beyond the width tile the design when `repeatAcross` is on (2.5), else stay
 * unlifted and are listed as idle (2.4). The inputs are not modified.
 */
export function buildLiftPlan(input: BuildInput): EngineResult<BuildOutput> {
  const validated = validateInput(input);
  if (!validated.ok) return err(validated.error);

  const { design, weaves, profile } = input;
  const repeatAcross = input.repeatAcross === true;
  const pickCount = design.length;
  const hookCount = profile.hookCount;
  const width = (design[0] as readonly number[]).length;

  const lifts: boolean[][] = [];
  for (let pick = 0; pick < pickCount; pick += 1) {
    const designRow = design[pick] as readonly number[];
    const row: boolean[] = [];
    for (let hook = 0; hook < hookCount; hook += 1) {
      if (hook < width) {
        row.push(evaluateWeave(weaves[designRow[hook] as number] as Weave, hook, pick));
      } else if (repeatAcross) {
        row.push(row[hook % width] as boolean);
      } else {
        row.push(false);
      }
    }
    lifts.push(row);
  }

  const idleHooks: number[] = [];
  if (!repeatAcross) {
    for (let hook = width; hook < hookCount; hook += 1) idleHooks.push(hook);
  }

  const plan: LiftPlan = { pickCount, hookCount, designWidth: width, repeatAcross, lifts };
  return ok({ plan, idleHooks, warnings: [] });
}
