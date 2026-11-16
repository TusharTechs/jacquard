// Feature: simulate-and-export, Property 7: Card SVG content
// For any valid plan and profile, the SVG is well-formed (balanced tags, one root), contains one
// card group per pick with its number as text, the number of filled hole elements equals the total
// punched count of buildCards, the number of empty hole elements equals total positions minus
// punched, and the untested-format sentence appears.
// Validates: Requirements 4.1, 4.4, 4.5
import * as fc from "fast-check";
import { buildCards } from "@jacquard/engine";
import { describe, expect, it } from "vitest";
import { cardSheetSvg } from "../src/index.js";
import { planCaseArb, titleArb } from "./arbitraries.js";
import { attributes, leafElements, startTags, unescapeXml, wellFormedProblem } from "./xml.js";

const SEED = 5107;
const NUM_RUNS = 100;

/** Requirement 4.5, written out here rather than imported from src. */
const NOTE =
  "Schematic, not to scale. The card format is a configurable loom profile and has not been tested on a working loom.";

describe("Feature: simulate-and-export, Property 7: Card SVG content", () => {
  it("draws one numbered card group per pick with filled and empty holes and the note", () => {
    fc.assert(
      fc.property(planCaseArb, fc.option(titleArb, { nil: undefined }), ({ plan, profile }, title) => {
        const result = cardSheetSvg(plan, profile, title === undefined ? {} : { title });
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        const svg = result.value;
        expect(wellFormedProblem(svg)).toBeUndefined();
        const engine = buildCards(plan, profile);
        if (!engine.ok) throw new Error(engine.error.message);
        const positions = plan.hookCount + profile.spareHookCount;

        // 4.1 one card group per pick, in order, each with its number as text.
        const groups = [...svg.matchAll(/<g class="card"((?:\s+[\w:-]+="[^"]*")*)>([\s\S]*?)<\/g>/g)];
        expect(groups).toHaveLength(plan.pickCount);
        let filledTotal = 0;
        let emptyTotal = 0;
        groups.forEach((group, index) => {
          const attrs = attributes(group[1]!);
          expect(attrs["data-number"]).toBe(String(index + 1));
          const body = group[2]!;
          const numbers = leafElements(body, "text").filter((t) => t.attrs["class"] === "card-number");
          expect(numbers.map((t) => t.text)).toEqual([String(index + 1)]);
          // 4.4 holes: filled circles for punched, outlines for unpunched.
          const holes = startTags(body, "circle").filter((c) => (c["class"] ?? "").split(" ").includes("hole"));
          expect(holes).toHaveLength(positions);
          const filled = holes.filter((c) => c["fill"] !== undefined && c["fill"] !== "none");
          const empty = holes.filter((c) => c["fill"] === "none" && c["stroke"] !== undefined && c["stroke"] !== "none");
          expect(filled.length + empty.length).toBe(positions);
          const punched = engine.value.cards[index]!.punched;
          expect(filled.length).toBe(punched.filter(Boolean).length);
          // Each drawn hole matches its position on the engine card.
          for (const hole of holes) {
            const q = Number(hole["data-position"]);
            expect(hole["fill"] !== "none", `card ${index + 1}, position ${q}`).toBe(punched[q]);
          }
          filledTotal += filled.length;
          emptyTotal += empty.length;
        });
        const totalPunched = engine.value.cards.reduce((sum, card) => sum + card.punched.filter(Boolean).length, 0);
        expect(filledTotal).toBe(totalPunched);
        expect(emptyTotal).toBe(plan.pickCount * positions - totalPunched);

        // 4.5 the note and the profile summary.
        const texts = leafElements(svg, "text").map((t) => unescapeXml(t.text));
        expect(texts).toContain(NOTE);
        const summary = texts.find((t) => t.includes("hooks per card row"));
        expect(summary).toBeDefined();
        expect(summary).toContain(`${profile.hookCount} hooks`);
        expect(summary).toContain(`${profile.spareHookCount} spare hook`);
        expect(summary).toContain(`${profile.hooksPerCardRow} hooks per card row`);
        expect(summary).toContain(profile.holeMeans === "lift" ? "lifts the hook" : "keeps the hook down");
        if (title !== undefined) expect(texts).toContain(title);
      }),
      { seed: SEED, numRuns: NUM_RUNS, verbose: 1 },
    );
  });
});
