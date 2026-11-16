// Cloth model (Requirement 1). See design.md, "Cloth model".
// A simulation from the lift plan, not a picture of woven cloth.
import { err, ok, type LiftPlan, type LoomProfile, type Side } from "@jacquard/engine";
import { isHexColour } from "./text.js";
import { checkPlan, exportError, type ClothCell, type ExportResult, type YarnColours } from "./types.js";

/** The first problem with a yarn list (1.4), or undefined when both lists are valid. */
function yarnProblem(yarns: YarnColours): string | undefined {
  if (typeof yarns !== "object" || yarns === null) return "yarns";
  for (const key of ["warp", "weft"] as const) {
    const list: unknown = yarns[key];
    if (!Array.isArray(list) || list.length === 0) return key;
    for (let index = 0; index < list.length; index += 1) {
      if (!isHexColour(list[index])) return `${key}[${index}]`;
    }
  }
  return undefined;
}

/** Checks the yarn colours (1.4). Shared with the WIF writer. */
export function checkYarns(yarns: YarnColours): ExportResult<YarnColours> {
  const problem = yarnProblem(yarns);
  if (problem === undefined) return ok(yarns);
  return err(
    exportError(
      "YARN_INVALID",
      `Yarn colours must be non-empty lists of #rrggbb hex colours; ${problem} is not.`,
      problem,
    ),
  );
}

/**
 * Returns `cells[pick][hook]` for one side of the cloth (1.1 to 1.3). The plan and profile go
 * through the engine checks first and their error is returned unchanged; then the yarns are checked
 * (1.4). On the side facing up on the loom a lifted hook shows its warp end; `wovenFaceDown` says
 * whether the face is that side (1.2). A warp cell takes `warp[hook mod warp.length]`, a weft cell
 * `weft[pick mod weft.length]` (1.3). Deterministic; the inputs are not modified (1.5).
 */
export function clothModel(
  plan: LiftPlan,
  profile: LoomProfile,
  yarns: YarnColours,
  side: Side,
): ExportResult<ClothCell[][]> {
  const checked = checkPlan(plan, profile);
  if (!checked.ok) return err(checked.error);
  const yarnCheck = checkYarns(yarns);
  if (!yarnCheck.ok) return err(yarnCheck.error);
  // top is warp exactly when lifts[pick][hook] !== (side === "back") !== wovenFaceDown.
  const flip = (side === "back") !== profile.wovenFaceDown;
  const cells: ClothCell[][] = [];
  for (let pick = 0; pick < plan.pickCount; pick += 1) {
    const lifts = plan.lifts[pick] as readonly boolean[];
    const weftColour = yarns.weft[pick % yarns.weft.length] as string;
    const row: ClothCell[] = [];
    for (let hook = 0; hook < plan.hookCount; hook += 1) {
      const warpOnTop = (lifts[hook] as boolean) !== flip;
      row.push(
        warpOnTop
          ? { top: "warp", colour: yarns.warp[hook % yarns.warp.length] as string }
          : { top: "weft", colour: weftColour },
      );
    }
    cells.push(row);
  }
  return ok(cells);
}
