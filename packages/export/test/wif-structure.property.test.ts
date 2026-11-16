// Feature: simulate-and-export, Property 4: WIF structure
// For any valid plan, the WIF text has every required section exactly once, in order; every line
// ends with \r\n; Shafts and [WARP] Threads equal hookCount; [WEFT] Threads equals pickCount;
// [THREADING] has hookCount entries i=i; [LIFTPLAN] has pickCount entries whose shaft lists are
// ascending, within 1 to hookCount, and equal to the lifted hooks plus one; and no line matches a
// date or time pattern.
// Validates: Requirements 3.1, 3.2, 3.3, 3.4
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { writeWif } from "../src/index.js";
import { planCaseArb, yarnsArb } from "./arbitraries.js";

const SEED = 5104;
const NUM_RUNS = 100;

/** Requirement 3.1, in the order of the list there (which is also the order of design.md). */
const REQUIRED = [
  "WIF",
  "CONTENTS",
  "WEAVING",
  "WARP",
  "WEFT",
  "COLOR PALETTE",
  "COLOR TABLE",
  "WARP COLORS",
  "WEFT COLORS",
  "THREADING",
  "LIFTPLAN",
];

const DATE_OR_TIME = [
  /\b\d{4}-\d{1,2}-\d{1,2}\b/,
  /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/,
  /\b\d{1,2}:\d{2}\b/,
  /^\s*(date|time|created|modified)\s*=/i,
  /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}\b/i,
];

function hexToRgbText(colour: string): string {
  const v = (at: number): number => Number.parseInt(colour.slice(at, at + 2), 16);
  return `${v(1)},${v(3)},${v(5)}`;
}

describe("Feature: simulate-and-export, Property 4: WIF structure", () => {
  it("writes the required sections and keys with CRLF endings and no date", () => {
    fc.assert(
      fc.property(planCaseArb, yarnsArb, ({ plan, profile }, yarns) => {
        const written = writeWif(plan, profile, yarns);
        expect(written.ok).toBe(true);
        if (!written.ok) return;
        const text = written.value;
        // 3.4 every line ends with \r\n: the text ends with one, and no bare \r or \n is left.
        expect(text.endsWith("\r\n")).toBe(true);
        const lines = text.slice(0, -2).split("\r\n");
        for (const line of lines) {
          expect(line.includes("\r") || line.includes("\n"), JSON.stringify(line)).toBe(false);
        }
        // Sections.
        const sections = new Map<string, string[]>();
        const order: string[] = [];
        let current: string[] | undefined;
        for (const line of lines) {
          const header = /^\[(.+)\]$/.exec(line);
          if (header !== null) {
            const name = header[1]!;
            expect(sections.has(name), `section [${name}] twice`).toBe(false);
            current = [];
            sections.set(name, current);
            order.push(name);
            continue;
          }
          expect(current, `line before the first section: ${line}`).toBeDefined();
          current!.push(line);
        }
        // 3.1 each required section exactly once (checked above) and in order.
        const positions = REQUIRED.map((name) => order.indexOf(name));
        for (const [index, at] of positions.entries()) expect(at, `[${REQUIRED[index]}] missing`).toBeGreaterThanOrEqual(0);
        expect([...positions].sort((a, b) => a - b)).toEqual(positions);
        const keys = (name: string): Map<string, string> => {
          const map = new Map<string, string>();
          for (const line of sections.get(name)!) {
            const at = line.indexOf("=");
            expect(at, `[${name}] ${line}`).toBeGreaterThan(0);
            const key = line.slice(0, at);
            expect(map.has(key), `[${name}] ${key} twice`).toBe(false);
            map.set(key, line.slice(at + 1));
          }
          return map;
        };
        expect(keys("WIF").get("Version")).toBe("1.1");
        // 3.3
        const weaving = keys("WEAVING");
        expect(weaving.get("Shafts")).toBe(String(plan.hookCount));
        expect(weaving.get("Treadles")).toBe("0");
        expect(weaving.get("Rising Shed")).toBe("true");
        expect(keys("WARP").get("Threads")).toBe(String(plan.hookCount));
        expect(keys("WEFT").get("Threads")).toBe(String(plan.pickCount));
        const palette = keys("COLOR PALETTE");
        expect(palette.get("Form")).toBe("RGB");
        expect(palette.get("Range")).toBe("0,255");
        expect(palette.get("Entries")).toBe(String(yarns.warp.length + yarns.weft.length));
        // Colour table and colour assignments follow the yarn lists.
        const table = keys("COLOR TABLE");
        const colours = [...yarns.warp, ...yarns.weft];
        expect(table.size).toBe(colours.length);
        colours.forEach((colour, index) => expect(table.get(String(index + 1))).toBe(hexToRgbText(colour)));
        const warpColours = keys("WARP COLORS");
        expect(warpColours.size).toBe(plan.hookCount);
        for (let end = 0; end < plan.hookCount; end += 1) {
          const entry = Number(warpColours.get(String(end + 1)));
          expect(table.get(String(entry))).toBe(hexToRgbText(yarns.warp[end % yarns.warp.length]!));
        }
        const weftColours = keys("WEFT COLORS");
        expect(weftColours.size).toBe(plan.pickCount);
        for (let pick = 0; pick < plan.pickCount; pick += 1) {
          const entry = Number(weftColours.get(String(pick + 1)));
          expect(table.get(String(entry))).toBe(hexToRgbText(yarns.weft[pick % yarns.weft.length]!));
        }
        // 3.2 threading i=i for every end, nothing else.
        const threading = sections.get("THREADING")!;
        expect(threading).toEqual(Array.from({ length: plan.hookCount }, (_, end) => `${end + 1}=${end + 1}`));
        // 3.2 one liftplan line per pick: the lifted hooks plus one, ascending, comma-separated.
        const liftplan = sections.get("LIFTPLAN")!;
        expect(liftplan).toHaveLength(plan.pickCount);
        liftplan.forEach((line, pick) => {
          const [key, value] = [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)];
          expect(key).toBe(String(pick + 1));
          const shafts = value === "" ? [] : value.split(",").map(Number);
          for (const shaft of shafts) {
            expect(Number.isInteger(shaft) && shaft >= 1 && shaft <= plan.hookCount, `pick ${pick + 1}: ${value}`).toBe(true);
          }
          for (let k = 1; k < shafts.length; k += 1) expect(shafts[k]!).toBeGreaterThan(shafts[k - 1]!);
          const lifted: number[] = [];
          plan.lifts[pick]!.forEach((up, hook) => {
            if (up) lifted.push(hook + 1);
          });
          expect(shafts).toEqual(lifted);
        });
        // 3.4 no date or time.
        for (const line of lines) {
          for (const pattern of DATE_OR_TIME) expect(pattern.test(line), `${line} matches ${pattern}`).toBe(false);
        }
      }),
      { seed: SEED, numRuns: NUM_RUNS, verbose: 1 },
    );
  });
});
