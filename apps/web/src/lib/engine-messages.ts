// Plain words for the engine's typed errors (10.4). The engine message says what is wrong; this
// adds what the designer can do next. No raw objects or stack traces reach the screen.
import type { EngineError } from "@jacquard/engine";

export function engineNextStep(error: EngineError): string {
  switch (error.code) {
    case "REPEAT_NOT_DIVISIBLE":
      return "Turn off “repeat across”, or choose a repeat width that divides the hook count.";
    case "DESIGN_TOO_WIDE":
      return "Choose a profile with more hooks, or a narrower repeat.";
    case "TOO_MANY_REGIONS":
      return "Paint over one of the regions, or raise the colour count if the profile allows it.";
    case "WEAVE_MISSING":
      return "Choose a weave for that region in the weave panel.";
    case "WEAVE_INVALID":
      return "Choose another weave for that region in the weave panel.";
    case "DESIGN_CELL_INVALID":
      return "Paint the highlighted cell again with one of the regions.";
    case "DESIGN_EMPTY":
    case "DESIGN_ROWS_UNEQUAL":
      return "Start from a blank grid or generate a new motif.";
    case "AUTOFIX_FAILED":
      return "Change the weave of the regions with violations, or repaint the cells, then try auto-fix again.";
    default:
      return "Undo the last change, or start from a blank grid.";
  }
}
