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
export type {
  BuilderColour,
  BuilderLayout,
  BuilderSize,
  BuilderSubject,
  CountRange,
  DescribeOptions,
  MotifDescription,
  MotifPlan,
  PlanOverrides,
} from "./describe.js";
export {
  ASYMMETRIC_SUBJECTS,
  BUILDER_COLOURS,
  BUILDER_LAYOUTS,
  BUILDER_SIZES,
  BUILDER_SUBJECTS,
  BUILDER_SYMMETRIES,
  COUNT_RANGES,
  FIGURE_SUBJECTS,
  SUBJECT_SYMMETRY,
  describeMotif,
  picksSymmetric,
} from "./describe.js";
export { buildMotif } from "./motif-builder.js";
