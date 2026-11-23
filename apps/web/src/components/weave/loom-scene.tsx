// The 3D Jacquard loom (studio-experience Requirement 6), a lazy chunk with three, r3f and drei.
// Stylised, not to scale. Everything that moves is read from the loom model each frame:
// - brass hooks, one per card position in rows of hooksPerCardRow, rise by hookHeight();
// - harness cords and warp ends follow their hooks, so the shed opens exactly where the card lifts;
// - the card chain shows the engine's cards in lacing order, the current card on the cylinder;
// - the shuttle crosses in the shuttle Phase, the reed beats in the beat Phase;
// - the cloth texture holds the woven picks from clothModel, newest at the fell.
// The clock is `timeRef` (moved by the Weave Step); this file only draws.
import { ContactShadows, Environment, Lightformer, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { cardRows } from "@jacquard/engine";
import type { Card, LoomProfile } from "@jacquard/engine";
import type { YarnColours } from "@jacquard/export";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { MutableRefObject } from "react";
import * as THREE from "three";
import { clothTexture, hookHeight, loomFrame } from "../../lib/loom-model";
import type { LoomModel } from "../../lib/loom-model";

// ---- Layout (scene units, stylised) ----
const WARP_WIDTH = 3.2;
const WARP_Y = 1.2;
const BACK_Z = -1.5;
const HEDDLE_Z = -0.6;
const FELL_Z = 0.1;
const FRONT_Z = 1.5;
const SHED = 0.32;
const COMBER_Y = 2.5;
const HEAD = { left: -1.3, right: 1.3, bottom: 3.2, top: 4.0, back: -1.0, front: -0.2 } as const;
const HOOK_LENGTH = 0.5;
const HOOK_RISE = 0.2;
const CYLINDER = { x: 1.78, y: 3.6, z: -0.6, size: 0.34 } as const;
const CARD_LENGTH = 0.95;
const CARDS_BEFORE = 2; // cards already read, above the cylinder
const CARDS_AFTER = 5; // cards to come, hanging below it

const COLOURS = {
  room: "#e9dfcb",
  floor: "#d6c8a8",
  walnut: "#5b3a24",
  brass: "#b8893a",
  brassDim: "#7d6a4a",
  brassLit: "#ffd27a",
  cord: "#cdbd98",
  cordLit: "#9a6a10",
  stock: "#efe3c8",
  hole: "#2a1d12",
  shuttle: "#9a6a3c",
} as const;

function endX(hook: number, hookCount: number): number {
  return -WARP_WIDTH / 2 + (WARP_WIDTH * (hook + 0.5)) / Math.max(1, hookCount);
}

/** Walnut grain drawn on a canvas once: streaks of one material, darker and lighter. */
function walnutTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = COLOURS.walnut;
  ctx.fillRect(0, 0, 256, 256);
  let seed = 7;
  const random = (): number => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let line = 0; line < 70; line += 1) {
    const y = random() * 256;
    ctx.strokeStyle = random() > 0.5 ? "rgba(30, 16, 8, 0.28)" : "rgba(140, 96, 60, 0.18)";
    ctx.lineWidth = 0.6 + random() * 2;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= 256; x += 16) ctx.lineTo(x, y + Math.sin(x / 40 + line) * 3 + (random() - 0.5) * 2);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** One card face, painted from the engine's cardRows: card stock, lacing holes, number, holes. */
function paintCard(canvas: HTMLCanvasElement, card: Card, profile: LoomProfile, current: boolean): void {
  const rows = cardRows(card, profile);
  const slots = profile.hooksPerCardRow;
  const ctx = canvas.getContext("2d");
  if (ctx === null) return;
  const { width, height } = canvas;
  const pitch = Math.min(width / (rows.length + 4.2), height / (slots + 1.4));
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = COLOURS.stock;
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = current ? COLOURS.brass : "rgba(90, 64, 40, 0.55)";
  ctx.lineWidth = current ? Math.max(3, pitch * 0.35) : 2;
  ctx.strokeRect(1, 1, width - 2, height - 2);
  const left = (width - pitch * (rows.length + 4.2)) / 2 + pitch * 2.6;
  const top = (height - pitch * slots) / 2;
  ctx.fillStyle = COLOURS.hole;
  for (const y of [height * 0.28, height * 0.72]) {
    for (const x of [pitch * 0.75, width - pitch * 0.75]) {
      ctx.beginPath();
      ctx.arc(x, y, pitch * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.save();
  ctx.translate(pitch * 1.75, height / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.font = `600 ${Math.max(10, pitch * 1.1)}px "IBM Plex Mono", monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#3b2a1c";
  ctx.fillText(String(card.number), 0, 0);
  ctx.restore();
  rows.forEach((row, rowIndex) => {
    row.forEach((state, slot) => {
      if (state === null) return;
      const x = left + (rowIndex + 0.5) * pitch;
      const y = top + (slot + 0.5) * pitch;
      ctx.beginPath();
      if (state) {
        ctx.fillStyle = COLOURS.hole;
        ctx.arc(x, y, pitch * 0.34, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.strokeStyle = "rgba(90, 64, 40, 0.3)";
        ctx.lineWidth = 1;
        ctx.arc(x, y, pitch * 0.2, 0, Math.PI * 2);
        ctx.stroke();
      }
    });
  });
}

function Wood({ position, size }: { readonly position: [number, number, number]; readonly size: [number, number, number] }) {
  const material = walnut();
  return (
    <mesh position={position} material={material} castShadow receiveShadow>
      <boxGeometry args={size} />
    </mesh>
  );
}

let walnutMaterial: THREE.MeshStandardMaterial | null = null;
function walnut(): THREE.MeshStandardMaterial {
  if (walnutMaterial === null) {
    walnutMaterial = new THREE.MeshStandardMaterial({ map: walnutTexture(), color: "#ffffff", roughness: 0.72, metalness: 0.02 });
  }
  return walnutMaterial;
}

function Frame() {
  const posts: [number, number, number][] = [];
  for (const x of [-2.1, 2.1]) {
    posts.push([x, 2.15, HEDDLE_Z]);
  }
  return (
    <group>
      {/* Tall posts carrying the Jacquard head, short posts at the back and front. */}
      {posts.map((position) => (
        <Wood key={position.join()} position={position} size={[0.16, 4.3, 0.16]} />
      ))}
      {[-2.1, 2.1].map((x) => (
        <group key={x}>
          <Wood position={[x, 0.7, BACK_Z]} size={[0.16, 1.4, 0.16]} />
          <Wood position={[x, 0.7, FRONT_Z]} size={[0.16, 1.4, 0.16]} />
          <Wood position={[x, 1.32, 0]} size={[0.12, 0.12, FRONT_Z - BACK_Z + 0.16]} />
          <Wood position={[x, 0.22, 0]} size={[0.12, 0.12, FRONT_Z - BACK_Z + 0.16]} />
        </group>
      ))}
      {/* Gantry, back beam and breast beam. */}
      <Wood position={[0, 4.3, HEDDLE_Z]} size={[4.36, 0.16, 0.2]} />
      <Wood position={[0, WARP_Y - 0.06, BACK_Z]} size={[4.2, 0.14, 0.18]} />
      <Wood position={[0, WARP_Y - 0.08, FRONT_Z]} size={[4.2, 0.16, 0.2]} />
      {/* The head: top, sides and needle board, open at the front so the hooks show. */}
      <Wood position={[0, HEAD.top, (HEAD.back + HEAD.front) / 2]} size={[HEAD.right - HEAD.left + 0.16, 0.08, HEAD.front - HEAD.back]} />
      <Wood position={[0, HEAD.bottom, (HEAD.back + HEAD.front) / 2]} size={[HEAD.right - HEAD.left + 0.16, 0.06, HEAD.front - HEAD.back]} />
      {[HEAD.left - 0.04, HEAD.right + 0.04].map((x) => (
        <Wood key={x} position={[x, (HEAD.top + HEAD.bottom) / 2, (HEAD.back + HEAD.front) / 2]} size={[0.08, HEAD.top - HEAD.bottom, HEAD.front - HEAD.back]} />
      ))}
      <Wood position={[0, (HEAD.top + 4.3) / 2, (HEAD.back + HEAD.front) / 2]} size={[0.1, 4.3 - HEAD.top, 0.1]} />
      {/* Comber board: spreads the harness cords across the warp. */}
      <Wood position={[0, COMBER_Y, HEDDLE_Z]} size={[WARP_WIDTH + 0.3, 0.05, 0.26]} />
    </group>
  );
}

interface SceneProps {
  readonly model: LoomModel;
  readonly yarns: YarnColours;
  readonly timeRef: MutableRefObject<number>;
  readonly playing: boolean;
  /** The transport's time; changes while paused (scrub, step) and once per pick while playing. */
  readonly t: number;
  readonly active: boolean;
}

function Loom({ model, yarns, timeRef, playing, t, active }: SceneProps) {
  const { invalidate } = useThree();
  const profile = model.profile;
  const slots = profile.hooksPerCardRow;
  const rowCount = Math.ceil(model.positionCount / slots);
  const warpColour = yarns.warp[0] ?? "#2b2b2b";
  const weftColour = yarns.weft[0] ?? "#d9a441";

  // ---- Hooks: one instance per card position. ----
  const hookMesh = useRef<THREE.InstancedMesh | null>(null);
  const hookPositions = useMemo(() => {
    const positions: [number, number][] = [];
    for (let position = 0; position < model.positionCount; position += 1) {
      const row = Math.floor(position / slots);
      const slot = position % slots;
      const x = HEAD.left + 0.12 + ((HEAD.right - HEAD.left - 0.24) * (row + 0.5)) / rowCount;
      const z = HEAD.back + 0.12 + ((HEAD.front - HEAD.back - 0.24) * (slot + 0.5)) / slots;
      positions.push([x, z]);
    }
    return positions;
  }, [model.positionCount, slots, rowCount]);
  const hookRadius = Math.min(0.018, ((HEAD.right - HEAD.left) / rowCount) * 0.22);

  const hookColours = useMemo(
    () => ({ dim: new THREE.Color(COLOURS.brassDim), brass: new THREE.Color(COLOURS.brass), lit: new THREE.Color(COLOURS.brassLit) }),
    [],
  );
  useLayoutEffect(() => {
    const mesh = hookMesh.current;
    if (mesh === null) return;
    for (let position = 0; position < model.positionCount; position += 1) {
      mesh.setColorAt(position, position < model.hookCount ? hookColours.brass : hookColours.dim);
    }
    if (mesh.instanceColor !== null) mesh.instanceColor.needsUpdate = true;
  }, [model, hookColours]);

  // ---- Cords and warp: line segments rewritten each frame. ----
  const cordGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(model.hookCount * 4 * 3), 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(model.hookCount * 4 * 3), 3));
    return geometry;
  }, [model.hookCount]);
  const cordColours = useMemo(() => ({ rest: new THREE.Color(COLOURS.cord), lit: new THREE.Color(COLOURS.cordLit) }), []);
  const warpGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(model.hookCount * 4 * 3), 3));
    return geometry;
  }, [model.hookCount]);
  const weftGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(2 * 3), 3));
    return geometry;
  }, []);
  useEffect(() => () => {
    cordGeometry.dispose();
    warpGeometry.dispose();
    weftGeometry.dispose();
  }, [cordGeometry, warpGeometry, weftGeometry]);

  // ---- Cloth: one texel per end-pick crossing, newest pick at the fell. ----
  const cloth = useMemo(() => {
    const data = new Uint8Array(Math.max(1, model.hookCount * model.pickCount) * 4);
    const texture = new THREE.DataTexture(data, Math.max(1, model.hookCount), Math.max(1, model.pickCount), THREE.RGBAFormat);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.LinearFilter;
    texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return { data, texture };
  }, [model]);
  useEffect(() => () => cloth.texture.dispose(), [cloth]);
  const wovenShown = useRef(-1);

  // ---- Card chain: a pool of planes around the current card, each with its own canvas. ----
  const cardHeight = Math.min(0.42, Math.max(0.14, (CARD_LENGTH * (slots + 1.4)) / (rowCount + 4.2)));
  const pool = useMemo(
    () =>
      Array.from({ length: CARDS_BEFORE + 1 + CARDS_AFTER }, () => {
        const canvas = document.createElement("canvas");
        canvas.width = 512;
        canvas.height = Math.max(64, Math.round((512 * cardHeight) / CARD_LENGTH));
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 4;
        return { canvas, texture, painted: -1, current: false };
      }),
    [cardHeight],
  );
  useEffect(() => () => pool.forEach((slot) => slot.texture.dispose()), [pool]);
  const cardMeshes = useRef<(THREE.Mesh | null)[]>([]);
  const cylinder = useRef<THREE.Mesh | null>(null);
  const shuttle = useRef<THREE.Group | null>(null);
  const reed = useRef<THREE.Group | null>(null);
  const painted = useRef(-1);

  const matrix = useMemo(() => new THREE.Matrix4(), []);
  const quaternion = useMemo(() => new THREE.Quaternion(), []);
  const scale = useMemo(() => new THREE.Vector3(1, 1, 1), []);
  const place = useMemo(() => new THREE.Vector3(), []);

  // Paused: draw once for every change of time (scrub, step, new plan).
  useEffect(() => {
    if (!playing && active) invalidate();
  }, [t, playing, model, active, invalidate]);

  useFrame(() => {
    const frame = loomFrame(model, timeRef.current);

    // Hooks.
    const mesh = hookMesh.current;
    if (mesh !== null) {
      for (let position = 0; position < model.positionCount; position += 1) {
        const [x, z] = hookPositions[position]!;
        const height = hookHeight(model, frame, position);
        place.set(x, HEAD.bottom + 0.06 + HOOK_LENGTH / 2 + HOOK_RISE * height, z);
        matrix.compose(place, quaternion, scale);
        mesh.setMatrixAt(position, matrix);
        // A lifted hook glows, so the selection the card makes reads at a glance.
        if (position < model.hookCount) mesh.setColorAt(position, height > 0 ? hookColours.lit : hookColours.brass);
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor !== null) mesh.instanceColor.needsUpdate = true;
    }

    // Harness cords (hook to comber board to heddle) and warp ends (back beam to heddle to fell).
    const cords = cordGeometry.getAttribute("position") as THREE.BufferAttribute;
    const cordTint = cordGeometry.getAttribute("color") as THREE.BufferAttribute;
    const warp = warpGeometry.getAttribute("position") as THREE.BufferAttribute;
    for (let hook = 0; hook < model.hookCount; hook += 1) {
      const height = hookHeight(model, frame, hook);
      const [hx, hz] = hookPositions[hook]!;
      const x = endX(hook, model.hookCount);
      const heddleY = WARP_Y + SHED * height;
      const hookBottom = HEAD.bottom + 0.06 + HOOK_RISE * height;
      cords.setXYZ(hook * 4, hx, hookBottom, hz);
      cords.setXYZ(hook * 4 + 1, x, COMBER_Y, HEDDLE_Z);
      cords.setXYZ(hook * 4 + 2, x, COMBER_Y, HEDDLE_Z);
      cords.setXYZ(hook * 4 + 3, x, heddleY, HEDDLE_Z);
      const tint = height > 0 ? cordColours.lit : cordColours.rest;
      for (let vertex = 0; vertex < 4; vertex += 1) cordTint.setXYZ(hook * 4 + vertex, tint.r, tint.g, tint.b);
      warp.setXYZ(hook * 4, x, WARP_Y, BACK_Z);
      warp.setXYZ(hook * 4 + 1, x, heddleY, HEDDLE_Z);
      warp.setXYZ(hook * 4 + 2, x, heddleY, HEDDLE_Z);
      warp.setXYZ(hook * 4 + 3, x, WARP_Y, FELL_Z);
    }
    cords.needsUpdate = true;
    cordTint.needsUpdate = true;
    warp.needsUpdate = true;

    // Shuttle and the weft it lays, then the reed beating it in.
    const half = WARP_WIDTH / 2 + 0.45;
    const shuttleX = frame.shuttle * half;
    if (shuttle.current !== null) {
      shuttle.current.position.set(shuttleX, WARP_Y + 0.06, (HEDDLE_Z + FELL_Z) / 2 + 0.05);
      shuttle.current.rotation.y = frame.shuttle >= 0 ? 0 : Math.PI;
    }
    const weft = weftGeometry.getAttribute("position") as THREE.BufferAttribute;
    const laying = frame.phase === "shuttle" || frame.phase === "beat";
    const startX = frame.pick % 2 === 0 ? -WARP_WIDTH / 2 : WARP_WIDTH / 2;
    const reedZ = -0.3 + (FELL_Z - 0.04 + 0.3) * frame.reed;
    const weftZ = frame.phase === "beat" ? Math.min(reedZ, FELL_Z) : (HEDDLE_Z + FELL_Z) / 2 + 0.05;
    weft.setXYZ(0, startX, WARP_Y + 0.02, weftZ);
    weft.setXYZ(1, laying ? Math.max(-WARP_WIDTH / 2, Math.min(WARP_WIDTH / 2, shuttleX)) : startX, WARP_Y + 0.02, weftZ);
    weft.needsUpdate = true;
    if (reed.current !== null) reed.current.position.z = reedZ;

    // Cloth: rewrite the texture only when a pick is beaten in.
    if (wovenShown.current !== frame.woven) {
      wovenShown.current = frame.woven;
      clothTexture(model, frame.woven, cloth.data);
      cloth.texture.needsUpdate = true;
      cloth.texture.offset.y = (frame.woven - model.pickCount) / Math.max(1, model.pickCount);
    }

    // Card cylinder: a quarter turn per card. Chain: cards slide one place in the advance Phase.
    if (cylinder.current !== null) cylinder.current.rotation.z = -(frame.pick + frame.advance) * (Math.PI / 2);
    if (painted.current !== frame.pick) {
      painted.current = frame.pick;
      pool.forEach((slot, index) => {
        const offset = index - CARDS_BEFORE;
        const card = ((frame.pick + offset) % model.pickCount + model.pickCount) % model.pickCount;
        const current = offset === 0;
        if (slot.painted !== card || slot.current !== current) {
          paintCard(slot.canvas, model.cards[card]!, profile, current);
          slot.painted = card;
          slot.current = current;
          slot.texture.needsUpdate = true;
        }
      });
    }
    pool.forEach((_, index) => {
      const node = cardMeshes.current[index];
      if (node === null || node === undefined) return;
      const place = index - CARDS_BEFORE + (1 - frame.advance);
      const gap = cardHeight + 0.035;
      const fold = Math.abs(place);
      node.position.set(CYLINDER.x + CYLINDER.size / 2 + 0.012 + fold * 0.035, CYLINDER.y - place * gap, CYLINDER.z);
      // Fold about the card's long axis, alternating, like a folded chain; then face the camera side.
      node.rotation.set((Math.round(place) % 2 === 0 ? 1 : -1) * Math.min(0.22, fold * 0.08), Math.PI / 2, 0, "YXZ");
      node.visible = model.pickCount > 1 || index === CARDS_BEFORE;
    });
  });

  const warpMaterial = useMemo(() => new THREE.LineBasicMaterial({ color: warpColour }), [warpColour]);
  const cordMaterial = useMemo(() => new THREE.LineBasicMaterial({ vertexColors: true }), []);
  const weftMaterial = useMemo(() => new THREE.LineBasicMaterial({ color: weftColour }), [weftColour]);
  useEffect(() => () => {
    warpMaterial.dispose();
    cordMaterial.dispose();
    weftMaterial.dispose();
  }, [warpMaterial, cordMaterial, weftMaterial]);

  return (
    <group>
      <Frame />
      <instancedMesh ref={hookMesh} args={[undefined, undefined, model.positionCount]} castShadow>
        <cylinderGeometry args={[hookRadius, hookRadius, HOOK_LENGTH, 6]} />
        <meshStandardMaterial color="#ffffff" metalness={0.75} roughness={0.32} />
      </instancedMesh>
      <lineSegments geometry={cordGeometry} material={cordMaterial} frustumCulled={false} />
      <lineSegments geometry={warpGeometry} material={warpMaterial} frustumCulled={false} />
      <lineSegments geometry={weftGeometry} material={weftMaterial} frustumCulled={false} />

      {/* Reed: a walnut frame with a brass comb, swinging towards the fell. */}
      <group ref={reed}>
        <mesh position={[0, WARP_Y + 0.42, 0]} material={walnut()}>
          <boxGeometry args={[WARP_WIDTH + 0.5, 0.07, 0.07]} />
        </mesh>
        <mesh position={[0, WARP_Y - 0.12, 0]} material={walnut()}>
          <boxGeometry args={[WARP_WIDTH + 0.5, 0.1, 0.12]} />
        </mesh>
        <mesh position={[0, WARP_Y + 0.15, 0]}>
          <boxGeometry args={[WARP_WIDTH + 0.2, 0.48, 0.01]} />
          <meshStandardMaterial color={COLOURS.brass} metalness={0.8} roughness={0.35} transparent opacity={0.28} />
        </mesh>
      </group>

      {/* Shuttle: a wooden boat with brass tips and a bobbin of the weft yarn. */}
      <group ref={shuttle}>
        <mesh rotation={[0, 0, Math.PI / 2]} scale={[1, 1, 0.55]} castShadow>
          <capsuleGeometry args={[0.055, 0.34, 4, 10]} />
          <meshStandardMaterial color={COLOURS.shuttle} roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.03, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.03, 0.03, 0.2, 10]} />
          <meshStandardMaterial color={weftColour} roughness={0.85} />
        </mesh>
      </group>

      {/* Cloth from the fell to the breast beam. */}
      <mesh position={[0, WARP_Y + 0.004, (FELL_Z + FRONT_Z) / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[WARP_WIDTH, FRONT_Z - FELL_Z]} />
        <meshStandardMaterial map={cloth.texture} transparent alphaTest={0.5} roughness={0.92} side={THREE.DoubleSide} />
      </mesh>

      {/* Card cylinder and chain. */}
      <mesh ref={cylinder} position={[CYLINDER.x, CYLINDER.y, CYLINDER.z]} material={walnut()} castShadow>
        <boxGeometry args={[CYLINDER.size, CYLINDER.size, CARD_LENGTH + 0.12]} />
      </mesh>
      {pool.map((slot, index) => (
        <mesh
          key={index}
          ref={(node) => {
            cardMeshes.current[index] = node;
          }}
        >
          <planeGeometry args={[CARD_LENGTH, cardHeight]} />
          <meshStandardMaterial map={slot.texture} roughness={0.85} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

const CAMERA_HOME = new THREE.Vector3(3.4, 3.1, 5.2);
const CAMERA_TARGET = new THREE.Vector3(0.25, 2.3, -0.3);

/** Keeps the whole loom in view on narrow (portrait) stages by moving the camera back. */
function Framing() {
  const { camera, size, invalidate } = useThree();
  useLayoutEffect(() => {
    const aspect = size.width / Math.max(1, size.height);
    const back = aspect >= 1.35 ? 1 : Math.min(1.9, 1.35 / aspect);
    const offset = CAMERA_HOME.clone().sub(CAMERA_TARGET).multiplyScalar(back);
    camera.position.copy(CAMERA_TARGET).add(offset);
    camera.lookAt(CAMERA_TARGET);
    camera.updateProjectionMatrix();
    invalidate();
  }, [camera, size.width, size.height, invalidate]);
  return null;
}

function useFinePointer(): boolean {
  return useMemo(() => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(pointer: fine)").matches, []);
}

export interface LoomSceneProps {
  readonly model: LoomModel;
  readonly yarns: YarnColours;
  readonly timeRef: MutableRefObject<number>;
  readonly playing: boolean;
  readonly t: number;
  /** False while the Weave Step is hidden: the scene stays mounted and draws nothing (6.8). */
  readonly active: boolean;
  /** Called once the WebGL context exists, so weaving starts where the user can see it. */
  readonly onReady?: () => void;
}

export default function LoomScene({ model, yarns, timeRef, playing, t, active, onReady }: LoomSceneProps) {
  const fine = useFinePointer();
  return (
    <div className="loom-stage" aria-hidden="true">
      <Canvas
        dpr={[1, 2]}
        frameloop={!active ? "never" : playing ? "always" : "demand"}
        shadows
        camera={{ position: [3.4, 3.1, 5.2], fov: 42, near: 0.1, far: 60 }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        onCreated={({ camera }) => {
          camera.lookAt(0.25, 2.3, -0.3);
          onReady?.();
        }}
      >
        <color attach="background" args={[COLOURS.room]} />
        <fog attach="fog" args={[COLOURS.room, 9, 20]} />
        <hemisphereLight args={["#fff4e0", "#8a6a48", 0.55]} />
        <directionalLight position={[-3.5, 7, 5]} intensity={2.1} color="#fff1d6" castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-4} shadow-camera-right={4} shadow-camera-top={5} shadow-camera-bottom={-2} />
        <directionalLight position={[5, 3, -4]} intensity={0.45} color="#dfe8ff" />
        <Environment resolution={128} frames={1}>
          <Lightformer form="rect" intensity={1.6} color="#fff0d0" position={[-3, 4, 4]} scale={[6, 3, 1]} />
          <Lightformer form="rect" intensity={0.7} color="#ffe2b8" position={[4, 2, -3]} scale={[4, 2, 1]} />
        </Environment>
        <Framing />
        <Loom model={model} yarns={yarns} timeRef={timeRef} playing={playing} t={t} active={active} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
          <planeGeometry args={[30, 30]} />
          <meshStandardMaterial color={COLOURS.floor} roughness={0.95} />
        </mesh>
        <ContactShadows position={[0, 0.005, 0]} opacity={0.35} scale={10} blur={2.4} far={4.5} frames={1} />
        {fine ? (
          <OrbitControls
            target={[0.25, 2.3, -0.3]}
            enablePan={false}
            minDistance={4}
            maxDistance={14}
            minPolarAngle={0.6}
            maxPolarAngle={1.45}
            minAzimuthAngle={-0.4}
            maxAzimuthAngle={1.3}
            enableDamping={false}
          />
        ) : null}
      </Canvas>
    </div>
  );
}
