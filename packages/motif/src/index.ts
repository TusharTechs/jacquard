// Public surface of @jacquard/motif. See design.md, "@jacquard/motif".
export type { Motif, MotifError, MotifResult, MotifSetup, MotifShape, Point, Repeat, Symmetry } from "./types.js";
export { parseMotif } from "./parse-motif.js";
export { rasterizeMotif } from "./rasterize.js";
export { applySymmetry } from "./symmetry.js";
export { removeSpecks } from "./specks.js";
export { motifToDesign } from "./motif-to-design.js";
export type { MotifErrorBody, MotifErrorCode, MotifInput, MotifRequest, MotifResponse } from "./request.js";
export { validateMotifRequest } from "./request.js";
export { STAND_IN_FAMILIES, standInMotif } from "./stand-in.js";
