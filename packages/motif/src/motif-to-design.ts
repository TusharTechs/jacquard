// Motif pipeline (7.6). See design.md, "Pipeline".
//
// parseMotif → rasterizeMotif → applySymmetry → removeSpecks → applySymmetry. Symmetry runs again
// after speck removal so that the final design is symmetric.
import { parseMotif } from "./parse-motif.js";
import { rasterizeMotif } from "./rasterize.js";
import { removeSpecks } from "./specks.js";
import { applySymmetry } from "./symmetry.js";
import type { MotifResult, MotifSetup } from "./types.js";

/** Turns Motif_SVG text into a design grid of exactly `setup.repeat` size, plus its palette. */
export function motifToDesign(svg: string, setup: MotifSetup): MotifResult<{ design: number[][]; palette: string[] }> {
  const parsed = parseMotif(svg, setup.colourCount);
  if (!parsed.ok) return parsed;
  const raster = rasterizeMotif(parsed.value, setup.repeat);
  const balanced = applySymmetry(raster, setup.symmetry);
  const cleaned = removeSpecks(balanced, setup.minFeature);
  const design = applySymmetry(cleaned, setup.symmetry);
  return { ok: true, value: { design, palette: [...parsed.value.palette] } };
}
