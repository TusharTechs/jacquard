// Label_Table (2.2 to 2.4): the Field_Label of every field of every built-in profile, copied from
// the bracketed token in the comment on that field in packages/engine/src/profiles.ts. Data only.
// When a comment holds more than one token, the least certain one is stored:
// [to verify] < [decision] < [convention] < [sourced]. The test label-table.property.test.ts
// checks every entry against profiles.ts.
import type { LoomProfile } from "@jacquard/engine";

export type FieldLabel = "[convention]" | "[sourced]" | "[decision]" | "[to verify]";
export type ProfileLabels = { readonly [K in keyof LoomProfile]: FieldLabel };
export type BuiltInName = "120" | "240" | "400";

const SMALL_PROFILE_LABELS: ProfileLabels = {
  hookCount: "[decision]",
  hooksPerCardRow: "[to verify]",
  spareHookCount: "[to verify]",
  spareHookPlacement: "[to verify]",
  maxFloat: "[decision]",
  maxWarpFloat: "[decision]",
  maxWeftFloat: "[decision]",
  regionLimit: "[decision]",
  holeMeans: "[convention]",
  cardFillOrder: "[to verify]",
  wovenFaceDown: "[decision]",
};

export const LABEL_TABLE: { readonly [N in BuiltInName]: ProfileLabels } = {
  "120": SMALL_PROFILE_LABELS,
  "240": SMALL_PROFILE_LABELS,
  "400": {
    hookCount: "[sourced]",
    hooksPerCardRow: "[sourced]",
    spareHookCount: "[sourced]",
    spareHookPlacement: "[to verify]",
    maxFloat: "[decision]",
    maxWarpFloat: "[decision]",
    maxWeftFloat: "[decision]",
    regionLimit: "[decision]",
    holeMeans: "[convention]",
    // The comment holds [sourced] (slot 0 at the top) and [to verify] (row 0 at the numbered end).
    cardFillOrder: "[to verify]",
    wovenFaceDown: "[decision]",
  },
};
