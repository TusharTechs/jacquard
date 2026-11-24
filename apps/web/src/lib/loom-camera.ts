// Camera placements for the 3D loom (studio-experience 18.2 to 18.4), as plain numbers so they can
// be checked without a renderer. The loom view shows the whole machine; the cloth view looks down
// on the woven cloth from slightly in front and frames the design: the whole cloth on wide stages,
// at least two and a half repeats (or the design width with repeat off) on narrow ones.
import { LAYOUT, clothDepth } from "./loom-layout";

export type Vec3 = readonly [number, number, number];
export interface CameraPlacement {
  readonly position: Vec3;
  readonly target: Vec3;
}

export interface ClothFraming {
  /** Stage width / height. */
  readonly aspect: number;
  /** Vertical field of view, degrees. */
  readonly fov: number;
  readonly hookCount: number;
  readonly pickCount: number;
  readonly designWidth: number;
  readonly repeatAcross: boolean;
}

/** The framed rectangle on the cloth: x from `left` to `right`, z from `near` (fell) to `far`. */
export interface ClothRegion {
  readonly left: number;
  readonly right: number;
  readonly near: number;
  readonly far: number;
  readonly y: number;
}

const HOME: Vec3 = [3.4, 3.1, 5.2];
const HOME_TARGET: Vec3 = [0.25, 2.3, -0.3];
/** Wider than this, the whole cloth is framed. */
export const WIDE_ASPECT = 1.2;
/** Repeats framed by the cloth view on narrow stages with repeat across on. */
export const REPEATS_FRAMED = 2.5;
/** Look down at the cloth at this angle above the horizontal, from the front. */
const ELEVATION = (66 * Math.PI) / 180;
/** The smallest region framed, scene units: keeps a tiny design readable and the camera off the near plane. */
const MIN_FRAME = 0.8;
/** Breathing room around the framed region. */
const MARGIN = 1.12;

/** The loom view: pulled back on portrait stages so the whole machine stays in view. */
export function loomViewCamera(aspect: number): CameraPlacement {
  const back = aspect >= 1.35 ? 1 : Math.min(1.9, 1.35 / Math.max(0.1, aspect));
  const position: Vec3 = [
    HOME_TARGET[0] + (HOME[0] - HOME_TARGET[0]) * back,
    HOME_TARGET[1] + (HOME[1] - HOME_TARGET[1]) * back,
    HOME_TARGET[2] + (HOME[2] - HOME_TARGET[2]) * back,
  ];
  return { position, target: HOME_TARGET };
}

export function clothRegion(framing: ClothFraming): ClothRegion {
  const full = LAYOUT.warpWidth;
  const perEnd = full / Math.max(1, framing.hookCount);
  const design = Math.min(full, perEnd * Math.max(1, framing.designWidth));
  // Wide stages show the whole cloth, so the repeating motif reads as a pattern; narrow ones at
  // least two and a half repeats, so each motif is large enough to read.
  let width: number;
  if (!framing.repeatAcross) width = design;
  else if (framing.aspect >= WIDE_ASPECT) width = full;
  else width = Math.min(full, design * REPEATS_FRAMED);
  const left = -full / 2;
  const depth = clothDepth(framing.hookCount, framing.pickCount);
  // A very small design is framed with some cloth around it, never closer than MIN_FRAME.
  return {
    left,
    right: left + Math.max(width, Math.min(full, MIN_FRAME)),
    near: LAYOUT.fellZ,
    far: LAYOUT.fellZ + Math.max(depth, Math.min(LAYOUT.frontZ - LAYOUT.fellZ, MIN_FRAME * 0.5)),
    y: LAYOUT.warpY,
  };
}

export function clothViewCamera(framing: ClothFraming): CameraPlacement {
  const region = clothRegion(framing);
  const width = Math.max(0.05, region.right - region.left);
  const depth = Math.max(0.05, region.far - region.near);
  const target: Vec3 = [(region.left + region.right) / 2, region.y, (region.near + region.far) / 2];
  const vertical = (framing.fov * Math.PI) / 180 / 2;
  const horizontal = Math.atan(Math.tan(vertical) * Math.max(0.1, framing.aspect));
  // Distance so the width fits the horizontal view and the depth (foreshortened) the vertical.
  const byWidth = (width / 2) * MARGIN / Math.tan(horizontal) + (depth / 2) * Math.cos(ELEVATION);
  const byDepth = ((depth / 2) * Math.sin(ELEVATION) * MARGIN) / Math.tan(vertical) + (depth / 2) * Math.cos(ELEVATION);
  const distance = Math.max(byWidth, byDepth);
  return {
    position: [target[0], target[1] + distance * Math.sin(ELEVATION), target[2] + distance * Math.cos(ELEVATION)],
    target,
  };
}

/** Smooth ease between two placements, `progress` 0 to 1. */
export function easeCamera(from: CameraPlacement, to: CameraPlacement, progress: number): CameraPlacement {
  const p = Math.min(1, Math.max(0, progress));
  const t = p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2;
  const mix = (a: Vec3, b: Vec3): Vec3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  return { position: mix(from.position, to.position), target: mix(from.target, to.target) };
}

/** The camera move's length, ms (a Moment: at most 1.5 s, 18.3). */
export const CAMERA_EASE_MS = 1200;
