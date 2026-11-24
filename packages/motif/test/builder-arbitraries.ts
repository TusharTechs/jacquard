// Generators for the motif-builder property tests: descriptions made of words from every table of
// the Describer, filler, numbers and random text, plus random options and chip overrides.
import * as fc from "fast-check";
import { BUILDER_COLOURS, BUILDER_LAYOUTS, BUILDER_SIZES, BUILDER_SUBJECTS, BUILDER_SYMMETRIES } from "../src/index.js";
import type { DescribeOptions, PlanOverrides } from "../src/index.js";

const VOCABULARY: readonly string[] = [
  // subjects and other names
  "lotus", "lotuses", "kamal", "peacock", "peacocks", "mor", "star", "stars", "diamond", "lozenge", "rhombus",
  "paisley", "kalga", "mango", "ambi", "rosette", "flower", "flowers", "phool", "tree", "tree of life", "elephant",
  "elephants", "hathi", "border", "stripe", "stripes", "striped", "check", "checked", "lattice", "jaal", "trellis",
  // counts
  "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "0", "3", "8", "13", "99",
  "petals", "petal", "points", "point", "pointed", "eight-point", "8-pointed", "bands", "teeth", "cells", "rays",
  // symmetry, size, layout, ground
  "mirror", "mirrored", "symmetric", "pair", "facing", "four-way", "4-fold", "radial", "asymmetric", "no symmetry",
  "top to bottom", "small", "tiny", "medium", "large", "big", "bold", "single", "butta", "medallion", "edge", "band",
  "all-over", "all over", "allover", "repeat", "scattered", "plain ground", "ground", "background", "on",
  // filler and unknown words
  "a", "an", "the", "with", "and", "of", "in", "motif", "pattern", "please", "thing", "swirl", "dragon", "constructor",
  "__proto__", "toString",
];

const COLOUR_WORDS: readonly string[] = [
  ...BUILDER_COLOURS.map((colour) => colour.name),
  "ivory", "crimson", "madder", "turmeric", "mustard", "navy", "violet", "walnut", "off-white", "gray",
];

const wordArb: fc.Arbitrary<string> = fc.oneof(
  { weight: 6, arbitrary: fc.constantFrom(...VOCABULARY) },
  { weight: 3, arbitrary: fc.constantFrom(...COLOUR_WORDS) },
  { weight: 1, arbitrary: fc.constantFrom(...COLOUR_WORDS).map((colour) => `${colour} ground`) },
  { weight: 1, arbitrary: fc.string({ maxLength: 10 }) },
  { weight: 1, arbitrary: fc.string({ unit: "grapheme", maxLength: 6 }) },
);

/** Descriptions: 0 to 16 words joined by spaces, hyphens or commas, sometimes upper case. */
export const descriptionArb: fc.Arbitrary<string> = fc
  .tuple(fc.array(wordArb, { maxLength: 16 }), fc.constantFrom(" ", "-", ", ", "  "), fc.boolean())
  .map(([words, separator, upper]) => {
    const text = words.join(separator);
    return upper ? text.toUpperCase() : text;
  });

export const overridesArb: fc.Arbitrary<PlanOverrides> = fc.record(
  {
    subject: fc.constantFrom(...BUILDER_SUBJECTS),
    count: fc.integer({ min: -2, max: 20 }),
    layout: fc.constantFrom(...BUILDER_LAYOUTS),
    size: fc.constantFrom(...BUILDER_SIZES),
    symmetry: fc.constantFrom(...BUILDER_SYMMETRIES),
    ground: fc.oneof(fc.constantFrom(...BUILDER_COLOURS.map((colour) => colour.name)), fc.string({ maxLength: 6 })),
    colourCount: fc.integer({ min: 0, max: 6 }),
  },
  { requiredKeys: [] },
);

export const optionsArb: fc.Arbitrary<DescribeOptions> = fc.record(
  {
    colourCount: fc.integer({ min: 1, max: 8 }),
    maxColours: fc.integer({ min: 2, max: 8 }),
    overrides: fc.oneof({ weight: 1, arbitrary: fc.constant({}) }, { weight: 2, arbitrary: overridesArb }),
  },
  { requiredKeys: ["colourCount"] },
);
