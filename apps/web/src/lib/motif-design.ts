// Turns motif SVG into a design grid with the current loom setup (7.6). The work is done by
// @jacquard/motif; this only passes the setup through.
import { motifToDesign } from "@jacquard/motif";
import type { MotifResult } from "@jacquard/motif";
import { motifSetupOf } from "../state/setup-state";
import type { SetupState } from "../state/setup-state";

export function designFromMotif(svg: string, setup: SetupState): MotifResult<{ design: number[][]; palette: string[] }> {
  return motifToDesign(svg, motifSetupOf(setup));
}
