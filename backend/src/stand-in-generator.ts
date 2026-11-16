// Generator that wraps the deterministic Stand_In from @jacquard/motif (Requirement 8, 1.5).
// Used when model access is not available. No network.
import { standInMotif } from "@jacquard/motif";
import type { MotifRequest } from "@jacquard/motif";
import type { Generator } from "./core.js";

export function createStandInGenerator(): Generator {
  return {
    source: "standIn",
    generate(request: MotifRequest): Promise<string> {
      return Promise.resolve(standInMotif(request));
    },
  };
}
