// The 3D loom's layout in scene units (stylised, not to scale [decision]), shared by the scene and
// the camera. The cloth keeps end-pick cells close to square (studio-experience 18.1), so a motif
// woven on it has the proportions it has on the point paper.

export const LAYOUT = {
  warpWidth: 3.2,
  warpY: 1.2,
  backZ: -1.5,
  heddleZ: -0.6,
  fellZ: 0.1,
  frontZ: 1.5,
} as const;

/** True when the cloth has to be shortened to fit before the breast beam, so cells are not square. */
export function clothShortened(hookCount: number, pickCount: number): boolean {
  return hookCount > 0 && pickCount > 0 && (LAYOUT.warpWidth * pickCount) / hookCount > LAYOUT.frontZ - LAYOUT.fellZ;
}

/** Depth of the woven cloth: warp width × picks / hooks, at most the room before the breast beam. */
export function clothDepth(hookCount: number, pickCount: number): number {
  if (!(hookCount > 0) || !(pickCount > 0)) return 0;
  return Math.min(LAYOUT.frontZ - LAYOUT.fellZ, (LAYOUT.warpWidth * pickCount) / hookCount);
}
