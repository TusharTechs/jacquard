// Feature: studio-experience, Property 9: The cloth view frames the woven design
// For any stage aspect from 0.4 to 2.6, field of view from 30 to 50 degrees, hook count, pick count
// and design width (with repeat on or off): with a three.js perspective camera placed by
// clothViewCamera, the four corners of the framed cloth region project inside the view, and the
// region fills at least 60 % of the view's width or height.
// Validates: Requirements 18.2, 18.4
import * as fc from "fast-check";
import { PerspectiveCamera, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { clothRegion, clothViewCamera, easeCamera, loomViewCamera } from "../src/lib/loom-camera";
import { LAYOUT, clothDepth } from "../src/lib/loom-layout";

const SEED = 7010;
const NUM_RUNS = 100;

const framingArb = fc
  .record({
    aspect: fc.double({ min: 0.4, max: 2.6, noNaN: true }),
    fov: fc.double({ min: 30, max: 50, noNaN: true }),
    hookCount: fc.constantFrom(120, 240, 400),
    pickCount: fc.integer({ min: 8, max: 400 }),
    repeatAcross: fc.boolean(),
    width: fc.integer({ min: 8, max: 120 }),
  })
  .map(({ width, ...rest }) => ({ ...rest, designWidth: Math.min(width, rest.hookCount) }));

describe("Feature: studio-experience, Property 9: The cloth view frames the woven design", () => {
  it("keeps the framed region in view and fills the view", () => {
    fc.assert(
      fc.property(framingArb, (framing) => {
        const placement = clothViewCamera(framing);
        const camera = new PerspectiveCamera(framing.fov, framing.aspect, 0.05, 100);
        camera.position.set(...placement.position);
        camera.lookAt(new Vector3(...placement.target));
        camera.updateMatrixWorld();
        camera.updateProjectionMatrix();
        const region = clothRegion(framing);
        const corners = [
          [region.left, region.near],
          [region.right, region.near],
          [region.left, region.far],
          [region.right, region.far],
        ].map(([x, z]) => new Vector3(x, region.y, z).project(camera));
        for (const corner of corners) {
          expect(Math.abs(corner.x)).toBeLessThanOrEqual(1);
          expect(Math.abs(corner.y)).toBeLessThanOrEqual(1);
          expect(corner.z).toBeLessThan(1);
        }
        const spanX = Math.max(...corners.map((c) => c.x)) - Math.min(...corners.map((c) => c.x));
        const spanY = Math.max(...corners.map((c) => c.y)) - Math.min(...corners.map((c) => c.y));
        expect(Math.max(spanX, spanY) / 2).toBeGreaterThanOrEqual(0.6);
      }),
      { seed: SEED, numRuns: NUM_RUNS, verbose: 1 },
    );
  });

  it("cloth cells stay square until the cloth would pass the breast beam (18.1)", () => {
    expect(clothDepth(240, 40)).toBeCloseTo((LAYOUT.warpWidth * 40) / 240);
    expect(clothDepth(120, 400)).toBe(LAYOUT.frontZ - LAYOUT.fellZ);
  });

  it("the ease starts at one placement, ends at the other", () => {
    const from = loomViewCamera(1.8);
    const to = clothViewCamera({ aspect: 1.8, fov: 42, hookCount: 240, pickCount: 40, designWidth: 40, repeatAcross: true });
    const close = (a: readonly number[], b: readonly number[]): void => a.forEach((value, index) => expect(value).toBeCloseTo(b[index]!, 9));
    close(easeCamera(from, to, 0).position, from.position);
    close(easeCamera(from, to, 1).position, to.position);
    close(easeCamera(from, to, 1).target, to.target);
  });
});
