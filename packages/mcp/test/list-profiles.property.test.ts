// Feature: weave-mcp, Property 2: list_profiles content
// Validates: Requirements 2.1, 2.2, 2.4, 2.5
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { PROFILE_120, PROFILE_240, PROFILE_400 } from "@jacquard/engine";
import type { LoomProfile } from "@jacquard/engine";
import { withConnection } from "./harness.js";

const SEED = 2002;
const NUM_RUNS = 100;
const LABELS = ["[convention]", "[sourced]", "[decision]", "[to verify]"];
const EXPECTED: readonly [string, LoomProfile][] = [
  ["120", PROFILE_120],
  ["240", PROFILE_240],
  ["400", PROFILE_400],
];

describe("Feature: weave-mcp, Property 2: list_profiles content", () => {
  it("lists 120, 240, 400 with every engine field as { value, label }", async () => {
    await withConnection(async (connection) => {
      await fc.assert(
        fc.asyncProperty(fc.boolean(), async (withEmptyObject) => {
          const result = await connection.call("list_profiles", withEmptyObject ? {} : undefined);
          expect(result.isError).not.toBe(true);
          const body = result.structuredContent as {
            profiles: { name: string; fields: Record<string, { value: unknown; label: string }> }[];
          };
          expect(body.profiles.map((p) => p.name)).toEqual(["120", "240", "400"]);
          body.profiles.forEach((listed, index) => {
            const [, profile] = EXPECTED[index] as [string, LoomProfile];
            expect(Object.keys(listed.fields).sort()).toEqual(Object.keys(profile).sort());
            for (const [key, value] of Object.entries(profile)) {
              const entry = listed.fields[key] as { value: unknown; label: string };
              expect(Object.keys(entry).sort()).toEqual(["label", "value"]);
              expect(entry.value).toEqual(value);
              expect(LABELS).toContain(entry.label);
            }
          });
        }),
        { seed: SEED, numRuns: NUM_RUNS, verbose: 1 },
      );
    });
  });
});
