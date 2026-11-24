// Feature: deploy-static, Property 1: The in-browser stand-in equals the backend's
// For any request (valid text prompts and sketches, colour counts 2 to 8, every symmetry, repeats
// 8 to 400, and invalid ones): when the backend returns 200, localStandIn returns a response
// deep-equal to the backend body; when it returns 400, localStandIn returns the same
// REQUEST_INVALID code and field.
// Validates: Requirements 1.2, 1.3
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { handleMotifRequest } from "../../../backend/src/core";
import { createStandInGenerator } from "../../../backend/src/stand-in-generator";
import { localStandIn } from "../src/lib/motif-local";

const SEED = 7111;
const NUM_RUNS = 100;
const TIMEOUT_MS = NUM_RUNS * 300;

const symmetry = fc.constantFrom("none", "mirrorEnds", "mirrorPicks", "mirrorBoth");
const repeat = fc.record({ ends: fc.integer({ min: 8, max: 400 }), picks: fc.integer({ min: 8, max: 400 }) });
const textInput = fc.string({ minLength: 1, maxLength: 120 }).filter((text) => text.trim() !== "").map((prompt) => ({ kind: "text", prompt }));
const sketchInput = fc
  .record({ mediaType: fc.constantFrom("image/png", "image/jpeg"), bytes: fc.uint8Array({ minLength: 1, maxLength: 512 }) })
  .map(({ mediaType, bytes }) => ({ kind: "sketch", mediaType, data: Buffer.from(bytes).toString("base64") }));
const valid = fc.record({ input: fc.oneof(textInput, sketchInput), colourCount: fc.integer({ min: 2, max: 8 }), symmetry, repeat });
const invalid = fc.oneof(
  valid.map((request) => ({ ...request, input: { kind: "text", prompt: "" } })),
  valid.chain((request) => fc.constantFrom(0, 1, 9, 2.5).map((colourCount) => ({ ...request, colourCount }))),
  valid.map((request) => ({ ...request, symmetry: "spiral" })),
  valid.chain((request) => fc.constantFrom(0, 7, 401).map((ends) => ({ ...request, repeat: { ends, picks: 48 } }))),
  valid.map((request) => ({ ...request, input: { kind: "sketch", mediaType: "image/gif", data: "AAAA" } })),
);

describe("Feature: deploy-static, Property 1: The in-browser stand-in equals the backend's", () => {
  it(
    "answers every request as the backend's stand-in does",
    async () => {
      const generator = createStandInGenerator();
      await fc.assert(
        fc.asyncProperty(fc.oneof({ weight: 3, arbitrary: valid }, { weight: 1, arbitrary: invalid }), async (request) => {
          const backend = await handleMotifRequest(JSON.stringify(request), { generator, timeoutMs: 25_000 });
          const local = localStandIn(JSON.parse(JSON.stringify(request)));
          if (backend.status === 200) {
            expect(local.ok).toBe(true);
            if (local.ok) expect(local.response).toEqual(backend.body);
          } else {
            expect(backend.status).toBe(400);
            expect(local.ok).toBe(false);
            if (!local.ok) {
              const body = backend.body as { code: string; field?: string };
              expect(local.error.code).toBe(body.code);
              expect(local.error.field).toBe(body.field);
            }
          }
        }),
        { seed: SEED, numRuns: NUM_RUNS, verbose: 1 },
      );
    },
    TIMEOUT_MS,
  );
});
