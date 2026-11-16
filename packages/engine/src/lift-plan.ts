// Lift plan builder (2.1 to 2.6) and seam warnings (2.12). See design.md, "Components and Interfaces", Lift plan builder.

import { planInvalid, type EngineResult } from "./errors.js";
import { err, ok } from "./result.js";
import { validateInput } from "./validate.js";
import { evaluateWeave, weavePeriod } from "./weaves.js";
import type { BuildInput, BuildOutput, LiftPlan, LoomProfile, Warning, Weave } from "./types.js";

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
  const used = new Set<number>();
  for (const designRow of design) for (const region of designRow) used.add(region);
  const warnings: Warning[] = [];
  for (const region of [...used].sort((a, b) => a - b)) {
    const period = weavePeriod(weaves[region] as Weave);
    if (pickCount % period !== 0) {
      warnings.push({ code: "WEAVE_PERIOD_SEAM", region, period, dimension: "picks", size: pickCount });
    }
    if (repeatAcross && width % period !== 0) {
      warnings.push({ code: "WEAVE_PERIOD_SEAM", region, period, dimension: "ends", size: width });
    }
  }

  return ok({ plan, idleHooks, warnings });
}

/**
 * Checks a lift plan against a profile (2.13), in the order from design.md, "Plan validation
 * order". Returns the first failure as `PLAN_INVALID` with `problem` and, where it applies, `pick`
 * and `hook`. The inputs are not modified.
 */
export function validatePlan(plan: LiftPlan, profile: LoomProfile): EngineResult<LiftPlan> {
  const { pickCount, hookCount, designWidth, repeatAcross, lifts } = plan;

  if (!Number.isInteger(pickCount) || pickCount < 1) return err(planInvalid("noPicks"));
  if (lifts.length !== pickCount) return err(planInvalid("pickCountMismatch"));
  if (hookCount !== profile.hookCount) return err(planInvalid("hookCountMismatch"));

  for (let pick = 0; pick < pickCount; pick += 1) {
    const row = lifts[pick];
    if (!Array.isArray(row) || row.length !== hookCount) return err(planInvalid("rowLength", pick));
    for (let hook = 0; hook < hookCount; hook += 1) {
      if (typeof row[hook] !== "boolean") return err(planInvalid("notBoolean", pick, hook));
    }
  }

  if (!Number.isInteger(designWidth) || designWidth < 1 || designWidth > hookCount) {
    return err(planInvalid("designWidth"));
  }
  if (repeatAcross && hookCount % designWidth !== 0) return err(planInvalid("repeatNotDivisible"));

  if (!repeatAcross) {
    for (let pick = 0; pick < pickCount; pick += 1) {
      const row = lifts[pick] as readonly boolean[];
      for (let hook = designWidth; hook < hookCount; hook += 1) {
        if (row[hook] === true) return err(planInvalid("idleLifted", pick, hook));
      }
    }
  } else {
    for (let pick = 0; pick < pickCount; pick += 1) {
      const row = lifts[pick] as readonly boolean[];
      for (let hook = designWidth; hook < hookCount; hook += 1) {
        if (row[hook] !== row[hook % designWidth]) return err(planInvalid("notPeriodic", pick, hook));
      }
    }
  }

  return ok(plan);
}
