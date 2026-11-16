// Example tests for loom profiles (tasks 4.2 and 4.3). Requirements 1.2 to 1.5.

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  PROFILE_120,
  PROFILE_240,
  PROFILE_400,
  defineProfile,
  validateProfile,
} from "../src/profiles.js";
import type { LoomProfile } from "../src/types.js";

describe("built-in profiles (1.3)", () => {
  it("PROFILE_120 has exactly the defaults in 1.2", () => {
    expect(PROFILE_120).toEqual({
      hookCount: 120,
      hooksPerCardRow: 8,
      spareHookCount: 0,
      spareHookPlacement: "afterFiguring",
      maxFloat: 8,
      maxWarpFloat: 8,
      maxWeftFloat: 8,
      regionLimit: 4,
      holeMeans: "lift",
      cardFillOrder: "ascending",
      wovenFaceDown: false,
    });
  });

  it("PROFILE_240 has exactly the defaults in 1.2", () => {
    expect(PROFILE_240).toEqual({
      hookCount: 240,
      hooksPerCardRow: 8,
      spareHookCount: 0,
      spareHookPlacement: "afterFiguring",
      maxFloat: 8,
      maxWarpFloat: 8,
      maxWeftFloat: 8,
      regionLimit: 4,
      holeMeans: "lift",
      cardFillOrder: "ascending",
      wovenFaceDown: false,
    });
  });

  it("PROFILE_400 has exactly the defaults in 1.2", () => {
    expect(PROFILE_400).toEqual({
      hookCount: 400,
      hooksPerCardRow: 8,
      spareHookCount: 16,
      spareHookPlacement: "afterFiguring",
      maxFloat: 8,
      maxWarpFloat: 8,
      maxWeftFloat: 8,
      regionLimit: 4,
      holeMeans: "lift",
      cardFillOrder: "ascending",
      wovenFaceDown: false,
    });
  });

  it("the built-in profiles are frozen", () => {
    expect(Object.isFrozen(PROFILE_120)).toBe(true);
    expect(Object.isFrozen(PROFILE_240)).toBe(true);
    expect(Object.isFrozen(PROFILE_400)).toBe(true);
  });

  it("PROFILE_400 gives 416 positions in 52 rows of 8 (2.8)", () => {
    const positions = PROFILE_400.hookCount + PROFILE_400.spareHookCount;
    expect(positions).toBe(416);
    expect(PROFILE_400.hooksPerCardRow).toBe(8);
    expect(Math.ceil(positions / PROFILE_400.hooksPerCardRow)).toBe(52);
  });

  it("every built-in profile passes validateProfile and is returned as it was given", () => {
    for (const profile of [PROFILE_120, PROFILE_240, PROFILE_400]) {
      const result = validateProfile(profile);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBe(profile);
    }
  });
});

describe("profile source labels (1.3)", () => {
  const source = readFileSync(new URL("../src/profiles.ts", import.meta.url), "utf8");
  const lines = source.split("\n");

  // A default line sets a profile field to a literal value, for example `hooksPerCardRow: 8, // ...`.
  const FIELD = [
    "hookCount",
    "hooksPerCardRow",
    "spareHookCount",
    "spareHookPlacement",
    "maxFloat",
    "maxWarpFloat",
    "maxWeftFloat",
    "regionLimit",
    "holeMeans",
    "cardFillOrder",
    "wovenFaceDown",
  ].join("|");
  const defaultLine = new RegExp(`^\\s+(${FIELD}):\\s*(-?\\d+|"[^"]*"|true|false),`);
  const defaultLines = lines.filter((line) => defaultLine.test(line));

  it("finds the default lines of the three built-ins and the fallback defaults", () => {
    // 11 fields in each built-in, and 10 in the fallback defaults (no hookCount).
    expect(defaultLines.length).toBe(11 * 3 + 10);
  });

  it("every default line has a bracketed label comment", () => {
    const label = /\/\/ \[(sourced|convention|decision|to verify)\]/;
    const unlabelled = defaultLines.filter((line) => !label.test(line));
    expect(unlabelled).toEqual([]);
  });

  it("every [sourced] line quotes S1", () => {
    const sourced = lines.filter((line) => line.includes("[sourced]"));
    expect(sourced.length).toBeGreaterThan(0);
    const unquoted = sourced.filter((line) => !/S1: "[^"]+"/.test(line));
    expect(unquoted).toEqual([]);
  });

  it("only PROFILE_400 has [sourced] default lines", () => {
    const start400 = lines.findIndex((line) => line.includes("export const PROFILE_400"));
    const sourcedBefore = lines.slice(0, start400).filter((line) => line.includes("[sourced]"));
    expect(sourcedBefore).toEqual([]);
  });
});

describe("defineProfile (1.4)", () => {
  it("hookCount 400 inherits the built-in profile, including the sourced 16 spare hooks", () => {
    expect(defineProfile({ hookCount: 400 })).toEqual(PROFILE_400);
    expect(defineProfile({ hookCount: 400 }).spareHookCount).toBe(16);
  });

  it("hookCount 120 and 240 inherit their built-in profiles", () => {
    expect(defineProfile({ hookCount: 120 })).toEqual(PROFILE_120);
    expect(defineProfile({ hookCount: 240 })).toEqual(PROFILE_240);
  });

  it("a caller override beats the built-in default", () => {
    const profile = defineProfile({ hookCount: 400, spareHookCount: 0, hooksPerCardRow: 10 });
    expect(profile.spareHookCount).toBe(0);
    expect(profile.hooksPerCardRow).toBe(10);
    expect(profile.regionLimit).toBe(4);
  });

  it("maxWarpFloat and maxWeftFloat follow the resolved maxFloat, not the built-in's own limits", () => {
    const profile = defineProfile({ hookCount: 400, maxFloat: 5 });
    expect(profile.maxFloat).toBe(5);
    expect(profile.maxWarpFloat).toBe(5);
    expect(profile.maxWeftFloat).toBe(5);
    const separate = defineProfile({ hookCount: 120, maxFloat: 5, maxWeftFloat: 3 });
    expect(separate.maxWarpFloat).toBe(5);
    expect(separate.maxWeftFloat).toBe(3);
  });

  it("any other hookCount gets the fallback defaults, with no spare hooks", () => {
    expect(defineProfile({ hookCount: 200 })).toEqual({
      hookCount: 200,
      hooksPerCardRow: 8,
      spareHookCount: 0,
      spareHookPlacement: "afterFiguring",
      maxFloat: 8,
      maxWarpFloat: 8,
      maxWeftFloat: 8,
      regionLimit: 4,
      holeMeans: "lift",
      cardFillOrder: "ascending",
      wovenFaceDown: false,
    });
  });

  it("keeps a given invalid field as given, so that validateProfile can reject it", () => {
    const profile = defineProfile({ hookCount: 0 });
    expect(profile.hookCount).toBe(0);
    const result = validateProfile(profile);
    expect(result.ok).toBe(false);
  });
});

describe("validateProfile rejects invalid fields (1.5)", () => {
  const valid: LoomProfile = PROFILE_400;

  // [field, invalid value]. One test per case; the field must be named in the error with its value.
  const invalidCases: readonly (readonly [string, unknown])[] = [
    ["hookCount", 0],
    ["hookCount", -1],
    ["hookCount", 1.5],
    ["hookCount", "8"],
    ["hookCount", Number.NaN],
    ["hookCount", undefined],
    ["hooksPerCardRow", 0],
    ["hooksPerCardRow", 2.5],
    ["spareHookCount", -1],
    ["spareHookCount", 1.5],
    ["spareHookPlacement", "beforeFiguring"],
    ["maxFloat", 0],
    ["maxFloat", 1.5],
    ["maxWarpFloat", 0],
    ["maxWarpFloat", -3],
    ["maxWeftFloat", Number.NaN],
    ["maxWeftFloat", 0],
    ["regionLimit", 0],
    ["regionLimit", 9],
    ["regionLimit", 2.5],
    ["holeMeans", "both"],
    ["holeMeans", undefined],
    ["cardFillOrder", "descending"],
    ["cardFillOrder", "mirrored"],
    ["wovenFaceDown", 1],
    ["wovenFaceDown", "true"],
  ];

  it.each(invalidCases)("%s = %s is rejected with PROFILE_INVALID naming the field", (field, value) => {
    const result = validateProfile({ ...valid, [field]: value });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("PROFILE_INVALID");
    if (result.error.code !== "PROFILE_INVALID") return;
    expect(result.error.field).toBe(field);
    expect(Object.is(result.error.value, value)).toBe(true);
    expect(result.error.message).toContain(field);
  });

  it("accepts regionLimit 1 and 8 and spareHookCount 0", () => {
    expect(validateProfile({ ...valid, regionLimit: 1 }).ok).toBe(true);
    expect(validateProfile({ ...valid, regionLimit: 8 }).ok).toBe(true);
    expect(validateProfile({ ...valid, spareHookCount: 0 }).ok).toBe(true);
  });

  it("rejects a profile that is not an object, naming the field 'profile'", () => {
    for (const value of [null, undefined, 3, "profile", [PROFILE_400]]) {
      const result = validateProfile(value);
      expect(result.ok).toBe(false);
      if (!result.ok && result.error.code === "PROFILE_INVALID") {
        expect(result.error.field).toBe("profile");
      }
    }
  });

  it("reports the first invalid field in the order of the 1.2 table", () => {
    const result = validateProfile({ ...valid, wovenFaceDown: 1, hooksPerCardRow: 0, holeMeans: "x" });
    expect(result.ok).toBe(false);
    if (!result.ok && result.error.code === "PROFILE_INVALID") {
      expect(result.error.field).toBe("hooksPerCardRow");
    }
  });

  it("ignores unknown extra fields", () => {
    expect(validateProfile({ ...valid, comment: "extra" }).ok).toBe(true);
  });
});
