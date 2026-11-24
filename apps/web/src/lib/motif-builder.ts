// The motif builder in the browser (motif-builder 3.1): the Describer and Builder from
// @jacquard/motif, loaded as a lazy chunk. It reads words only and calls nothing over the network.
// The SVG is checked with parseMotif before it reaches the editor, as every motif is.
import { buildMotif, describeMotif, parseMotif } from "@jacquard/motif";
import type { MotifDescription, PlanOverrides } from "@jacquard/motif";

export interface BuildOptions {
  /** The loom setup's colour count (used when fewer than two figure colours are named). */
  readonly colourCount: number;
  /** The profile's region limit. */
  readonly maxColours: number;
  readonly overrides?: PlanOverrides;
}

export type BuiltMotif =
  | { readonly ok: true; readonly description: MotifDescription; readonly svg: string; readonly palette: readonly string[] }
  | { readonly ok: false; readonly description: MotifDescription; readonly message: string };

/** What the builder understood, for the Chips; cheap enough to run on every keystroke. */
export function describe(text: string, options: BuildOptions): MotifDescription {
  return describeMotif(text, options);
}

/** Description to checked Motif_SVG. */
export function buildFromDescription(text: string, options: BuildOptions): BuiltMotif {
  const description = describeMotif(text, options);
  const svg = buildMotif(description.plan);
  const parsed = parseMotif(svg, description.plan.colours.length);
  if (!parsed.ok) {
    return { ok: false, description, message: "The motif builder could not draw this. Change a chip or the description and try again." };
  }
  return { ok: true, description, svg, palette: [...parsed.value.palette] };
}
