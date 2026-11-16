// Model prompt for the Bedrock generator. See design.md, "Backend", prompt.ts.
//
// The system prompt states the Motif_SVG rules (Requirement 4) so that the model writes a clean,
// limited-colour vector motif. The backend still validates every reply with parseMotif (13.4);
// the prompt only makes a valid reply likely.
import type { MotifRequest, Symmetry } from "@jacquard/motif";

/** Side of the square viewBox the model is asked to draw in. */
const VIEWBOX_SIZE = 100;
/** Thinnest shape the prompt asks for, in design cells [decision]: the request carries no Minimum_Feature. */
const MIN_FEATURE_CELLS = 2;
/** Bounds on the requested minimum shape width, in viewBox units [decision]. */
const MIN_WIDTH_FLOOR = 4;
const MIN_WIDTH_CEILING = 20;

const SYMMETRY_TEXT: Readonly<Record<Symmetry, string>> = {
  none: "No mirror symmetry is required.",
  mirrorEnds: "Make the motif mirror-symmetric left to right (about the vertical line x = 50).",
  mirrorPicks: "Make the motif mirror-symmetric top to bottom (about the horizontal line y = 50).",
  mirrorBoth:
    "Make the motif mirror-symmetric both left to right (about x = 50) and top to bottom (about y = 50).",
};

/** Thinnest shape, in viewBox units, that still covers about MIN_FEATURE_CELLS cells. */
export function minimumShapeWidth(request: MotifRequest): number {
  const cells = Math.min(request.repeat.ends, request.repeat.picks);
  const width = Math.ceil((VIEWBOX_SIZE * MIN_FEATURE_CELLS) / cells);
  return Math.min(MIN_WIDTH_CEILING, Math.max(MIN_WIDTH_FLOOR, width));
}

/** System prompt: the Motif_SVG rules for this request. */
export function buildSystemPrompt(request: MotifRequest): string {
  const { colourCount } = request;
  return [
    "You draw motifs for jacquard handloom designs. Reply with one SVG document and nothing else, inside a ```svg fenced block.",
    "",
    "Rules for the SVG:",
    `1. One <svg> root element with xmlns="http://www.w3.org/2000/svg" and viewBox="0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}".`,
    `2. The first child is a background <rect x="0" y="0" width="${VIEWBOX_SIZE}" height="${VIEWBOX_SIZE}"> with a flat fill.`,
    "3. Use only these elements: g, rect, circle, ellipse, polygon, path, and optionally title and desc.",
    "4. On shapes use only the shape's geometry attributes, fill, id, and transform with translate, scale or matrix only.",
    "5. Every fill is a flat hex colour (#rrggbb). No gradients, patterns, strokes, opacity, filters, masks, clip paths, text, images, style attributes or CSS.",
    "6. Path data uses only the commands M, L, H, V and Z (absolute or relative). No curves or arcs.",
    `7. Use at most ${colourCount} distinct fill colours in total, counting the background colour.`,
    `8. Use bold, simple shapes. No part of a shape is thinner than ${minimumShapeWidth(request)} units, and no gap between shapes is narrower than that.`,
    `9. ${SYMMETRY_TEXT[request.symmetry]}`,
    "10. Do not use scripts, event attributes, links, href, DOCTYPE, entities or processing instructions.",
    "",
    `The motif is one repeat of ${request.repeat.ends} warp ends by ${request.repeat.picks} picks; the viewBox maps onto that grid.`,
  ].join("\n");
}

/** User message text: the designer's prompt, or the instruction that goes with a sketch image. */
export function buildUserText(request: MotifRequest): string {
  if (request.input.kind === "text") {
    return `Draw this motif: ${request.input.prompt}`;
  }
  return "Redraw the attached sketch as a clean motif that follows the rules. Keep its main shapes and simplify the detail.";
}
