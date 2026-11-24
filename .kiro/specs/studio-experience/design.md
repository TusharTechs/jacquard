# Design Document: studio-experience

Traces to `requirements.md`. Acceptance criteria are cited as `N.M`, correctness properties as Property N.

## Overview

```
main.tsx ── <App/> (the Studio) + <Opening/> (first visit only)
              │ step: React state, recorded with history.pushState (lib/route.ts)
              ├─ TopBar (brand, framing line, setup chip, menu)        StepRail (Design · Check · Weave · Cards)
              ├─ Design: Gallery, Motif, LoomSetup ┐
              ├─ workbench: the one PointPaper     ├ shared by Design and Check
              ├─ Check: FloatPanel, SimulatorPanel (2D cloth, unchanged), WeavePanel
              ├─ Weave: WeaveStep ── lazy LoomScene (three, r3f, drei)
              │         lib/loom-model.ts ◄── engine buildCards / decodeCards / nextCard, export clothModel
              │         lib/loom-sound.ts (lazy tone)
              └─ Cards: CardsStep (CardChain, CardFace, PrintSheet) + ExportPanel
```

All new code in `apps/web` is display logic: timing, layout, the order of animation, drawing. Lifts, cards and cloth colours come from the packages (15.4).

## Architecture

### Look (Requirement 1)

`styles.css` starts with `@import "tailwindcss";`, then `@theme inline` tokens that point at custom properties:

| Token | Value | Use |
|---|---|---|
| `--room` | `#e9dfcb` | page (card stock) |
| `--surface` / `--raised` / `--sunk` | `#f6f0e2` / `#fffaf0` / `#ebe1cc` | panels, inputs, wells |
| `--ink` / `--ink-muted` | `#1f1a14` / `#5a4f42` | text |
| `--line` / `--line-strong` | `#d3c6a8` / `#9c8c6c` | rules, control borders |
| `--walnut` / `--primary` | `#5b3a24` / `#4a2e1b` | primary buttons, rail |
| `--brass` / `--brass-strong` | `#8a6420` / `#6e4f17` | accent, current Step |
| `--focus-colour` | `#1d5c63` | focus ring |
| `--paper` | `#fbf7ee` | point paper sheet |

Fonts: Fraunces (headings), Instrument Sans (interface), IBM Plex Mono (numbers), imported in `main.tsx`. The card-stock fibre is `public/grain.svg` at low opacity: texture of one material, not a gradient (1.2). The existing semantic classes (`.btn`, `.panel`, `.field`, `.note`, `.marker-*`, `.panel-empty`) are kept so the panel tests do not change, and restyled from the tokens; new components use Tailwind utilities and a few `studio-*` classes.

### Studio shell (Requirements 2 and 3)

`app.tsx` keeps every state, reducer and handler. New state: `step` (initial `currentStep()`), changed by `goTo(step)` = `changeView(() => setStep(step))` + `pushStep(step)`; a `popstate` listener reads the URL back. The JSX:

```
<Tooltip.Provider>
 <div class="studio">
  <TopBar/>  <StepRail/>
  <main class="studio-stage" data-step={step}>
    <div class="area-start"  hidden={step≠design}>  Gallery, Motif
    <div class="area-setup"  hidden={step≠design}>  LoomSetup, Continue to Check
    <div class="area-bench"  hidden={step∉{design,check}}>  Point paper Panel
    <div class="area-checks" hidden={step≠check}>   FloatPanel, SimulatorPanel, WeavePanel, Continue to Weave
    <div class="area-weave"  hidden={step≠weave}>   WeaveStep, Continue to Cards
    <div class="area-cards"  hidden={step≠cards}>   CardsStep, ExportPanel
  </main>
  <Toaster/> <Dialog shortcuts/>
```

`.studio-stage` is a CSS grid whose `grid-template-areas` depend on `data-step`: Design `"start bench setup"`, Check `"bench checks"`, Weave and Cards one area. Below 768 px every Step is one column and the rail is fixed to the bottom (2.8). The DOM order (Gallery, Motif, Loom setup, Point paper, Float check, Cloth simulation, Weave per region, 3D loom, Export) keeps the reading order of the old page.

`goToFloatCheck`, `focusProfile`, `focusGallery` and `focusMotif` call `goTo` first and focus after the next frame (2.7). The keydown handler adds Alt+1..4 by `event.code` (2.9).

`lib/view-transition.ts`: `changeView(update)` runs `document.startViewTransition(() => flushSync(update))` when available and motion is allowed (2.6); CSS sets a 200 ms cross-fade.

Step_Rail status: Design "48×48" (repeat), Check the violation count or "OK", Weave the pick count, Cards the card count. "Continue" buttons are `btn-primary` with an arrow icon (3.2).

### Primitives (Requirement 4)

- `ui/dialog.tsx`: same props as today. Radix `Root open onOpenChange`, `Portal`, `Overlay`, `Content asChild` around `<dialog open className="dialog">`, `Title`. The opener is remembered in `onOpenAutoFocus`; when `open` turns false a layout effect returns focus to it, or to `fallbackFocus` when it is gone or disabled; `onCloseAutoFocus` prevents Radix's later focus. The footer button calls `onClose`.
- `ui/hint.tsx`: a 24 px (44 px hit area on touch) "i" button, `aria-label="About <topic>"`, wrapping a Radix Tooltip that is controlled: open on hover and focus (Radix), toggled on click or tap, closed on Escape and blur (5.1).
- `ui/icon-button.tsx`: `Button` with a lucide icon, `aria-label` and a Radix Tooltip of the same text (4.4).
- `ui/toaster.tsx`: sonner `<Toaster>` styled from tokens; `notify(text, { sticky })` with `duration: Infinity` and a Dismiss action when sticky (4.3). `say()` in `app.tsx` calls it.
- `shell/studio-menu.tsx`: Radix DropdownMenu with "Point paper shortcuts", "Show the opening again" and "About the card format".

### Weave Step (Requirements 6 to 9)

`weave/weave-step.tsx` (Studio chunk, small) owns the Loom_Model (`useMemo(buildLoomModel(planInUse, profile, yarns))`), the transport reducer (`lib/loom-transport.ts`: `{ playing, speed, t }`, actions `play`, `pause`, `toggle`, `seek`, `step`, `setSpeed`, `reset`), the readout, the flat card strip (`cards/card-face.tsx`), the sound toggle, and `<Suspense>` + an error boundary around the lazy `weave/loom-scene.tsx`.

The playing clock lives in the scene: `useFrame` advances a ref by `dt × speed × 2` picks and calls `onPick(pick)` only when the whole part changes, so React renders the transport about twice a second. Without WebGL (`typeof WebGL2RenderingContext === "undefined"` or context creation fails) the Step uses an interval clock, so transport, readout and card strip still work (6.6). The scene lowers `frameloop` to `"demand"` when paused or hidden (6.8, 14.3).

`weave/loom-scene.tsx` (lazy chunk: three, r3f, drei):

- `<Canvas dpr={[1, 2]} camera={{ position: [5.4, 3.4, 6.6], fov: 36 }} shadows>`, warm key light, cool fill, ambient, `ContactShadows` from drei.
- Frame: walnut boxes (uprights, top beam, breast beam, back beam), `meshStandardMaterial` walnut, roughness 0.7.
- Jacquard head: a walnut box on the top beam; brass hooks as one `InstancedMesh`, one instance per card position, columns across x by card row, depth by slot; spare positions dimmed. Each frame sets instance `y = base + rise × hookHeight` (Property 1).
- Harness and warp: one `LineSegments` per group; per figuring hook a cord from the hook to the comber board and a warp end from the back beam to the heddle to the fell. Heddle height follows the hook (6.3).
- Card cylinder and chain: a square prism turning a quarter turn in the advance Phase; a pool of 8 card planes (2 read, the current one, 5 to come) taken from `cardStrip`, each with a `CanvasTexture` painted by `paintCard(canvas, card, profile)` from `cardRows`; when the pick changes the textures shift and only the new card is painted (6.4).
- Shuttle: a wooden boat shape crossing the shed in the shuttle Phase, alternating direction by pick. Reed: a bar that swings in the beat Phase.
- Cloth: a plane from the fell to the breast beam with a `DataTexture` (`hookCount × pickCount`, RGBA, nearest) filled by `clothTexture(model, woven)`; only rows that change are rewritten (Property 2).

`lib/loom-model.ts` (pure):

```ts
export const PHASE_ENDS = { advance: 0.2, lift: 0.35, shuttle: 0.7, beat: 0.85 } as const;
export interface LoomModel {
  readonly pickCount: number; readonly hookCount: number; readonly positionCount: number;
  readonly profile: LoomProfile;
  readonly cards: readonly Card[];                       // buildCards
  readonly lifted: readonly (readonly boolean[])[];      // per card, decodeCards of that card alone
  readonly cloth: readonly (readonly ClothCell[])[];     // clothModel(plan, profile, yarns, "face")
}
export function buildLoomModel(plan, profile, yarns): Result<LoomModel, EngineError | ExportError>;
export type PhaseName = "advance" | "lift" | "shuttle" | "beat" | "settle";
export interface LoomFrame { pick; cardNumber; phase: PhaseName; progress; rise; woven; shuttle; reed }
export function loomFrame(model, t): LoomFrame;
export function hookHeight(model, frame, position): number;
export function raisedPositions(model, frame): number[];
export function liftedCount(model, pick): number;
export function clothTexture(model, woven, target?): Uint8Array;  // RGBA, row = pick
export function cardStrip(pickCount, pick, before, after): number[];  // via nextCard
```

`lifted[i]` is `decodeCards({ designWidth, repeatAcross, cards: [{ ...cards[i], index: 0, number: 1 }] }, profile)`, so the hole-meaning rule stays in the engine (9.7).

`lib/loom-sound.ts`: `createLoomSound()` lazy-imports `tone`, calls `Tone.start()`, builds a NoiseSynth + high-pass (clack), MetalSynth (tick), NoiseSynth + band-pass sweep (whoosh), MembraneSynth (thud) at low volume; `onPhase(phase)` plays each kind once per pick; `dispose()` when hidden or off (8.1 to 8.4).

### Opening (Requirement 10)

`opening.tsx`, rendered by `main.tsx` next to `<App/>` when `localStorage["jacquard.openingSeen"]` is not set and the hash is empty or `#/design`. A fixed full-screen layer, `role="dialog"`, `aria-modal="false"` with `aria-label="Opening"`: a walnut-black room, a faint outline of a Jacquard head and a hanging card chain (inline SVG), the line in Fraunces, and "Skip". `motion` animates: line fades in at 0.4 s, the room's light rises at 2.6 s, the layer fades out at 3.6 s, then unmounts and sets the key. Escape, Enter, click and Skip end it at once and focus the Studio's `h1`. Reduced motion: no fades, the layer simply leaves at 3.6 s or on skip (10.4).

### Moments (Requirement 11)

- `lib/reveal.ts`: `revealOrder(ends, picks)` (pick-major from pick 0) and `revealedCount(elapsed, total, duration)`. `PointPaper` gets an optional `reveal` key; while it runs, `drawPointPaper` paints only the first `revealedCount` cells of the order and paper colour elsewhere. Pointer down, key down or a Step change ends it (Property 5).
- Violation pulse: marks and flips are drawn on an overlay canvas `.paper-marks` above the point paper canvas; CSS animates its opacity between 1 and 0.55 while violations are shown. Outline and triangle are on that canvas in every frame (11.2).
- `lib/flip-sequence.ts`: `flipSchedule(flipCount, duration)` and `flipsShownAt(schedule, elapsed)` (Property 6); `PointPaper` draws that prefix of the engine's flips as diamonds.
- Card punching: `CardFace` with `punch` animates each hole with `motion`, delayed by its row (11.4).

### Cards Step (Requirement 12)

- `cards/card-face.tsx`: an SVG card from the engine's `cardRows`: card-stock fill, grain, rounded corners, two lacing holes at each end, the number at the numbered end, punched holes filled with the room colour, unpunched positions as faint rings.
- `cards/card-chain.tsx`: up to 24 cards around the selection, overlapped like a laced chain with a lace line; `role="listbox"` with `aria-activedescendant`; arrows, Home and End move the selection; the selected card is shown large with its number and punched count.
- `cards/print-sheet.tsx`: rendered on `beforeprint` (with `flushSync`) and by "Print cards": every card in lacing order, the untested-format note, the profile summary. `@media print` hides everything else (12.3).

### Performance (Requirement 14)

Dynamic imports give separate chunks for the loom scene and tone. A build test reads the entry chunk and checks it holds no three.js, r3f, drei or tone code. Lighthouse runs through the Chrome DevTools MCP server on `vite preview`.

## Correctness Properties

Each property has its own property test task: fast-check, fixed seed, `numRuns: 100`, tag `Feature: studio-experience, Property N: <title>`.

### Property 1: The loom lifts exactly the hooks the current card punches

For random designs, weaves and profiles (`holeMeans` `lift` and `noLift`, spare hooks, repeat across on and off), the engine's plan, and any Loom_Time: in the shuttle Phase the positions with `hookHeight === 1` equal `{ h < hookCount : card.punched[h] !== (holeMeans === "noLift") }` for the current card, which equals `{ h : plan.lifts[pick][h] }`; in every Phase each position with `hookHeight > 0` is in that set; spare positions are always 0.
**Validates: Requirements 9.1, 9.3, 6.2, 6.3**

### Property 2: Cloth growth matches the lift plan pick for pick

For the same inputs and any `t1 ≤ t2`: `woven(t1) ≤ woven(t2)`; `woven(t)` is `pick` before the end of the beat and `pick + 1` after; `woven(pickCount) = pickCount`. `clothTexture(model, woven)` holds, for each pick below `woven`, the RGBA of `clothModel`'s colour of the side facing up on the loom (face, or back when `wovenFaceDown`) for every hook, and alpha 0 for every other pick; on every profile a texel is the warp colour exactly when `plan.lifts[pick][hook]`.
**Validates: Requirements 9.4, 9.5, 6.3**

### Property 3: Loom time maps to card and phase

For any model and any finite `t` (negative and past `pickCount` included): `pick = min(floor(clamp(t)), pickCount - 1)`, `cardNumber = pick + 1`, Phases follow advance, lift, shuttle, beat, settle as the fraction grows, and `progress` is in `[0, 1]`.
**Validates: Requirements 9.2, 7.2**

### Property 4: The card strip follows the lacing chain

For any `pickCount`, `pick`, `before` and `after`: `cardStrip` returns `min(before + 1 + after, pickCount)` distinct indices, `pick` is among them at position `min(before, …)`, and each index is the engine's `nextCard` of the one before it.
**Validates: Requirements 9.6, 6.4, 12.2**

### Property 5: The motif reveal places every cell once

For any `ends`, `picks` and elapsed times: `revealOrder` is a permutation of the `ends × picks` cells in pick-major order from pick 0; `revealedCount` is non-decreasing in elapsed time, 0 at the start and `ends × picks` at the duration or later.
**Validates: Requirements 11.1, 11.5**

### Property 6: Auto-fix placement shows the engine's flips in order

For the engine's `autoFix` output on random plans: one schedule entry per flip in the engine's order, start times non-decreasing and inside the duration, the flips shown at any time are a prefix of the engine's list, and all are shown at the duration.
**Validates: Requirements 11.3**

### Property 7: Step route round trip

For every Step, `parseStep(stepHref(step))` is that Step; any other hash gives Design.
**Validates: Requirements 2.3**

## Wave 5: the woven result shows the design

- `lib/repeat-policy.ts`: `repeatFits(ends, hookCount)`, and a reducer over `{ repeatAcross, chosen }` with actions `arrive(ends, hookCount)`, `reshape(ends, hookCount)` (profile or width changed) and `choose(on)`. `app.tsx` keeps this state next to the setup and dispatches `setRepeatAcross` when it changes (Property 8).
- `scripts/gallery/generate.ts`: every input sets `repeatAcross: true`; `pnpm gallery` rewrites `apps/web/public/gallery/`. The gallery panel's claims already come from `checkDesign` with the example's own setup, so they are recomputed with repeat on.
- `lib/loom-layout.ts`: the scene's layout constants (warp width, fell, breast beam, warp height) and `clothDepth(hookCount, pickCount)`, shared by the scene and the camera.
- `lib/loom-camera.ts`: `loomViewCamera(aspect)` and `clothViewCamera({ aspect, fov, hookCount, pickCount, designWidth, repeatAcross })`, pure numbers (`position`, `target`), and `easeCamera(from, to, progress)`. The cloth view frames the whole cloth when the stage is wide, else at least 2.5 repeats or the design width, centred on the design's left edge, from above and slightly in front (Property 9).
- `weave/loom-scene.tsx`: a `CameraRig` holds the view ("loom" or "cloth"), eases position and target over 1.2 s with `easeCamera`, and moves the OrbitControls target with it; controls are off while it eases. The cloth plane takes `clothDepth`.
- `weave/weave-step.tsx`: a "Cloth view" toggle in the transport; when playback reaches the end it switches to the cloth view (an eased Moment; under reduced motion the switch is instant and only by the button).
- `editor-toolbar.tsx`: Undo, Redo, Fit and the region readout stay; a "View" button opens a Radix Popover holding Zoom out, the cell-size slider, Zoom in, the one-finger Paint and Scroll buttons, Show region numbers and Shortcuts. The popover content carries `data-region-keys`, so region keys keep working there.
- `loom-setup-panel.tsx`: the summary line reads "<summary> · Edit" (or "Done" when open), folded by default.

### Property 8: Repeat follows the design until the user chooses

For any sequence of arrivals, reshapes (profile or width) and user choices: while no choice has been made since the last arrival, `repeatAcross` equals `repeatFits(ends, hookCount)` for the latest shape; after a choice it equals that choice until the next arrival, whatever the reshapes.
**Validates: Requirements 17.1, 17.2**

### Property 9: The cloth view frames the woven design

For any stage aspect from 0.4 to 2.6, field of view from 30 to 50 degrees, hook count, pick count and design width (with repeat on or off): with a three.js perspective camera placed by `clothViewCamera`, the four corners of the framed cloth region project inside the view, and the region fills at least 60 % of the view's width or height.
**Validates: Requirements 18.2, 18.4**

### Property 10: With repeat on, the cards span the card

For random designs whose width divides the hook count and the engine's plan with repeat across on: every card's lift (read back through the engine's `decodeCards`) is periodic in the design width across all figuring hooks, so every column of holes in the first repeat is punched again in the last one.
**Validates: Requirements 17.3**

## Error Handling

- `buildLoomModel` returns the engine or export error unchanged; the Weave Step shows the simulator's engine-error state with "Go to the float check".
- The scene's error boundary: "The 3D loom could not start on this device. The card, readout and controls still work."
- A failed lazy chunk (offline) shows the same line with Retry.
- `tone` failing to load or start turns the sound toggle off with a toast.

## Testing Strategy

- Property tests for Properties 1 to 7 in `apps/web/test/*.property.test.ts`.
- Component tests: rail (aria-current, URL, Alt+digit, cross-Step focus), the first-minute path (3.3: activations counted from the empty Studio to the print call), Hint (hover, focus, tap, Escape), Weave Step without WebGL (transport, readout, card strip, states, autoplay off with reduced motion), sound toggle (off by default, `aria-pressed`), Cards Step (keyboard selection, print sheet renders every card), Opening (shown once, skip by key and button, focus moves, not shown on `#/check`).
- Existing App tests get `openStep` (15.3).
- Build test for the entry chunk (14.1).
- Chrome DevTools MCP screenshots and Lighthouse (16.1, 14.2); `design-reviewer` per wave; `weave-auditor` at the end.
