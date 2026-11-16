// Feature: simulate-and-export, Property 5: WIF reader rejects broken files
// For any written WIF with one fault (the [LIFTPLAN] section removed, the [THREADING] section
// removed, one threading entry changed to another shaft, one liftplan shaft set to 0 or to
// hookCount + 1), readWif returns WIF_INVALID.
// Validates: Requirements 3.6
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { readWif, writeWif } from "../src/index.js";
import { planCaseArb, yarnsArb } from "./arbitraries.js";

const SEED = 5105;
const NUM_RUNS = 100;

const FAULTS = ["noLiftplan", "noThreading", "threadingShaft", "shaftZero", "shaftTooHigh"] as const;
type Fault = (typeof FAULTS)[number];

/** Removes a section: its header and every line up to the next header. */
function removeSection(lines: string[], name: string): string[] {
  const start = lines.indexOf(`[${name}]`);
  if (start < 0) throw new Error(`no [${name}]`);
  let stop = start + 1;
  while (stop < lines.length && !lines[stop]!.startsWith("[")) stop += 1;
  return [...lines.slice(0, start), ...lines.slice(stop)];
}

function lineOf(lines: string[], section: string, key: number): number {
  const start = lines.indexOf(`[${section}]`);
  const at = lines.findIndex((line, index) => index > start && line.startsWith(`${key}=`));
  if (at < 0) throw new Error(`no ${key}= in [${section}]`);
  return at;
}

function breakWif(text: string, fault: Fault, hookCount: number, pickCount: number, a: number, b: number): string {
  let lines = text.slice(0, -2).split("\r\n");
  switch (fault) {
    case "noLiftplan":
      lines = removeSection(lines, "LIFTPLAN");
      break;
    case "noThreading":
      lines = removeSection(lines, "THREADING");
      break;
    case "threadingShaft": {
      const end = 1 + (a % hookCount);
      // Another shaft: any other number from 1 to hookCount + 1 (with one hook, only 2 differs).
      let shaft = 1 + (b % (hookCount + 1));
      if (shaft === end) shaft = (shaft % (hookCount + 1)) + 1;
      lines[lineOf(lines, "THREADING", end)] = `${end}=${shaft}`;
      break;
    }
    case "shaftZero":
    case "shaftTooHigh": {
      const pick = 1 + (a % pickCount);
      const at = lineOf(lines, "LIFTPLAN", pick);
      const value = lines[at]!.slice(lines[at]!.indexOf("=") + 1);
      const bad = fault === "shaftZero" ? "0" : String(hookCount + 1);
      const shafts = value === "" ? [] : value.split(",");
      if (shafts.length === 0) shafts.push(bad);
      else shafts[b % shafts.length] = bad;
      lines[at] = `${pick}=${shafts.join(",")}`;
      break;
    }
  }
  return lines.map((line) => `${line}\r\n`).join("");
}

describe("Feature: simulate-and-export, Property 5: WIF reader rejects broken files", () => {
  it("returns WIF_INVALID for a file with one fault", () => {
    fc.assert(
      fc.property(
        planCaseArb,
        yarnsArb,
        fc.constantFrom(...FAULTS),
        fc.nat(),
        fc.nat(),
        ({ plan, profile }, yarns, fault, a, b) => {
          const written = writeWif(plan, profile, yarns);
          expect(written.ok).toBe(true);
          if (!written.ok) return;
          const broken = breakWif(written.value, fault, plan.hookCount, plan.pickCount, a, b);
          expect(broken).not.toBe(written.value);
          const read = readWif(broken);
          expect(read.ok, `${fault} was accepted`).toBe(false);
          if (read.ok) return;
          expect(read.error.code).toBe("WIF_INVALID");
          // 3.6 the error names the problem.
          const detail = "detail" in read.error ? read.error.detail : undefined;
          expect(typeof detail).toBe("string");
          const named = fault === "noLiftplan" ? "LIFTPLAN" : fault === "noThreading" || fault === "threadingShaft" ? "THREADING" : "LIFTPLAN";
          expect(detail).toContain(named);
        },
      ),
      { seed: SEED, numRuns: NUM_RUNS, verbose: 1 },
    );
  });
});
