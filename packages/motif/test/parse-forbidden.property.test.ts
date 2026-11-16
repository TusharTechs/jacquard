// Feature: motif-input, Property 2: Forbidden constructs are rejected
// For any valid generated Motif_SVG and any one forbidden construct inserted at a generated
// position (a forbidden element, an `on*` attribute, `href`, `xlink:href`, `style`, a DOCTYPE or
// ENTITY declaration, a processing instruction, a non-hex fill, a path command outside MLHVZ),
// parseMotif returns MOTIF_SVG_INVALID, with a reason naming that construct (4.3).
// Validates: Requirements 4.1, 4.2, 4.3
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { parseMotif } from "../src/index.js";
import { elementCount, motifDocArb, serializeMotif } from "./arbitraries.js";
import type { Injection, MotifDoc } from "./arbitraries.js";

const SEED = 4802;
const NUM_RUNS = 100;

const FORBIDDEN_ELEMENTS = [
  "script",
  "foreignObject",
  "image",
  "use",
  "style",
  "text",
  "a",
  "defs",
  "linearGradient",
  "line",
  "polyline",
  "svg",
  "animate",
  "iframe",
] as const;

const elementMarkupArb = fc
  .record({ name: fc.constantFrom(...FORBIDDEN_ELEMENTS), form: fc.nat({ max: 2 }) })
  .map(({ name, form }) => {
    const markup =
      form === 0 ? `<${name}/>` : form === 1 ? `<${name} id="x">alert(1)</${name}>` : `<${name}><rect width="1" height="1"/></${name}>`;
    return { markup, reason: `element:${name}` };
  });

const attributeArb = fc.oneof(
  fc
    .record({ head: fc.constantFrom("on", "On", "ON"), tail: fc.stringMatching(/^[a-z]{1,8}$/) })
    .map(({ head, tail }) => ({ text: `${head}${tail}="alert(1)"`, reason: `attribute:${head}${tail}` })),
  fc.constant({ text: 'href="#a"', reason: "attribute:href" }),
  fc.constant({ text: 'xlink:href="#a"', reason: "attribute:xlink:href" }),
  fc.constant({ text: 'style="fill:red"', reason: "attribute:style" }),
);

const declarationArb = fc.constantFrom(
  { markup: "<!DOCTYPE svg>", reason: "doctype" },
  { markup: '<!DOCTYPE svg [<!ENTITY x "y">]>', reason: "doctype" },
  { markup: '<!ENTITY x "y">', reason: "entity" },
  { markup: '<?xml-stylesheet href="a.css"?>', reason: "processingInstruction" },
  { markup: "<?php echo 1; ?>", reason: "processingInstruction" },
  { markup: "<?pi?>", reason: "processingInstruction" },
);

const badFillArb = fc.constantFrom("red", "url(#g)", "rgb(1,2,3)", "#12", "#ggg", "#12345", "#1234567", "currentColor", "transparent", "None", "#fff;", "");

const badPathArb = fc
  .record({ letter: fc.constantFrom("C", "c", "S", "s", "Q", "q", "T", "t", "A", "a"), relative: fc.boolean() })
  .map(({ letter }) => {
    const args: Record<string, string> = { C: "1 2 3 4 5 6", S: "1 2 3 4", Q: "1 2 3 4", T: "1 2", A: "1 1 0 0 1 2 2" };
    return { markup: `<path d="M0 0 L1 1 ${letter}${args[letter.toUpperCase()]!} Z" fill="#000"/>`, reason: `pathCommand:${letter}` };
  });

interface Case {
  readonly doc: MotifDoc;
  readonly injection: Injection;
  readonly reason: string;
}

const caseArb: fc.Arbitrary<Case> = motifDocArb.chain((doc) => {
  const count = elementCount(doc);
  /** Before element 1 .. count-1, or before `</svg>` (index count). */
  const bodyPosition = fc.integer({ min: 1, max: count });
  const anyElement = fc.integer({ min: 0, max: count - 1 });
  const choices: fc.Arbitrary<Case>[] = [
    fc.tuple(elementMarkupArb, bodyPosition).map(([{ markup, reason }, index]) => ({ doc, reason, injection: { beforeElement: { index, text: markup } } })),
    fc.tuple(attributeArb, anyElement).map(([{ text, reason }, index]) => ({ doc, reason, injection: { attribute: { index, text } } })),
    declarationArb.map(({ markup, reason }) => ({ doc, reason, injection: { prolog: markup } })),
    fc.tuple(declarationArb, bodyPosition).map(([{ markup, reason }, index]) => ({ doc, reason, injection: { beforeElement: { index, text: markup } } })),
    fc.tuple(badPathArb, bodyPosition).map(([{ markup, reason }, index]) => ({ doc, reason, injection: { beforeElement: { index, text: markup } } })),
    fc.tuple(badFillArb, bodyPosition).map(([value, index]) => ({
      doc,
      reason: `fill:${value}`,
      injection: { beforeElement: { index, text: `<rect width="1" height="1" fill="${value}"/>` } },
    })),
  ];
  if (count > 1) {
    choices.push(
      fc.tuple(badFillArb, fc.integer({ min: 1, max: count - 1 })).map(([value, index]) => ({ doc, reason: `fill:${value}`, injection: { fill: { index, value } } })),
    );
  }
  return fc.oneof(...choices);
});

describe("Feature: motif-input, Property 2: Forbidden constructs are rejected", () => {
  it("rejects every inserted forbidden construct with MOTIF_SVG_INVALID naming it", () => {
    fc.assert(
      fc.property(caseArb, fc.integer({ min: 1, max: 8 }), ({ doc, injection, reason }, limit) => {
        // The unmodified document is valid Motif_SVG (any colour count is fine for this check).
        const clean = parseMotif(serializeMotif(doc), 100);
        expect(clean.ok).toBe(true);
        const svg = serializeMotif(doc, injection);
        const result = parseMotif(svg, limit);
        expect(result.ok, svg).toBe(false);
        if (result.ok) return;
        expect(result.error.code, svg).toBe("MOTIF_SVG_INVALID");
        if (result.error.code === "MOTIF_SVG_INVALID") expect(result.error.reason, svg).toBe(reason);
      }),
      { seed: SEED, numRuns: NUM_RUNS, verbose: 1 },
    );
  });
});
