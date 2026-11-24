// Motifs without a backend (deploy-static 1.1, 1.2): the deterministic stand-in from
// @jacquard/motif, run in the browser. It mirrors the backend's handling of a request when its
// generator is the stand-in (backend/src/core.ts): validate the request, generate the SVG, check it
// with parseMotif, and answer { svg, palette, source: "standIn" }. Loaded lazily, only by the
// static deploy, which has no backend.
import { parseMotif, standInMotif, validateMotifRequest } from "@jacquard/motif";
import type { MotifErrorBody, MotifResponse } from "@jacquard/motif";

export type LocalMotifResult = { readonly ok: true; readonly response: MotifResponse } | { readonly ok: false; readonly error: MotifErrorBody };

export function localStandIn(request: unknown): LocalMotifResult {
  const validation = validateMotifRequest(request);
  if (!validation.ok) return { ok: false, error: validation.error };
  const svg = standInMotif(validation.value);
  const motif = parseMotif(svg, validation.value.colourCount);
  if (!motif.ok) {
    const code = motif.error.code === "MOTIF_TOO_MANY_COLOURS" ? "MOTIF_TOO_MANY_COLOURS" : "MOTIF_SVG_INVALID";
    return { ok: false, error: { code, message: motif.error.message } };
  }
  return { ok: true, response: { svg, palette: [...motif.value.palette], source: "standIn" } };
}
