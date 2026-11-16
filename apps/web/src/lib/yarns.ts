// Yarn colours for the simulator and the WIF file (2.3). Yarns are separate from region display
// colours: regions are weave structures, not yarns (Decision log, "Yarn colours").
import type { YarnColours } from "@jacquard/export";

/** One warp colour and one weft colour, `#rrggbb`. */
export interface YarnChoice {
  readonly warp: string;
  readonly weft: string;
}

/** Default warp: a dark neutral (Decision log). The default weft is region 0's display colour. */
export const DEFAULT_WARP = "#2b2b2b";

/** The Yarn_Colours lists `@jacquard/export` takes, one colour each. */
export function yarnColours(choice: YarnChoice): YarnColours {
  return { warp: [choice.warp], weft: [choice.weft] };
}
