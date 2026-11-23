# Design Document: studio-experience

Traces to `requirements.md`. Acceptance criteria are cited as `N.M`, correctness properties as Property N.

## Overview

```
index.html ── inline theme bootstrap (1.4) ── main.tsx ── <Root>
                                                        │  lib/route.ts (hash)
                         ┌──────────────────────────────┴────────────────────────────┐
                 #/  lazy Story                                              #/studio/<step>  lazy Studio (= App)
                 components/story/*                                          app.tsx: state as today
                 └─ idle + no reduced motion: lazy story-motion.ts           ├─ TopBar, StepRail, CommandPalette, Toaster
                    (gsap, ScrollTrigger, lenis)                             ├─ Design: Gallery, Motif, LoomSetup  ┐ shared
                                                                             ├─ Check: FloatPanel, WeavePanel      ┘ PointPaper
                                                                             ├─ Weave: WeaveStep ── lazy LoomScene (three, r3f, drei)
                                                                             │         lib/loom-model.ts ◄── engine buildCards/decodeCards/nextCard
                                                                             │         lib/loom-sound.ts (lazy tone)          export clothModel
                                                                             │         SimulatorPanel + lib/draw-threads.ts
                                                                             └─ Cards: CardsStep (CardChain, PrintSheet) + ExportPanel
```

The engine, export and motif packages are called as today. All new logic in `apps/web` is display logic: timing, layout, order of animation, drawing. Lifts, cards and cloth colours come from the packages (16.4).

## Architecture

### Entry and routes (2.3, 10.5, 15.1)

- `index.html` runs a five-line inline script before the bundle: read `localStorage["jacquard.theme"]`, else `matchMedia("(prefers-color-scheme: dark)")`, and set `data-theme` on `<html>`. No flash of the wrong Theme.
- `lib/route.ts`: `type Route = { page: "story" } | { page: "studio"; step: Step }`, `parseHash(hash)`, `hrefFor(route)`, `useRoute()` (listens to `hashchange`), `navigate(route)`. Unknown studio steps fall back to `design` (Property 9).
- `root.tsx`: `React.lazy` for `components/story/story.tsx` and for `app.tsx`; the Story prefetches the Studio chunk on idle. Tests render `<App />` directly.

### Themes and tokens (1.1 to 1.6)

`styles.css` starts with `@import "tailwindcss";`, then `@theme` tokens and two `[data-theme]` blocks that set CSS variables:

| Token | Daylight | After hours |
|---|---|---|
| `--color-room` (page) | `#e9dfcb` card-stock | `#120d09` walnut-black |
| `--color-surface` (panel) | `#f6f0e2` | `#1f1711` |
| `--color-surface-raised` | `#fffaf0` | `#2a2018` |
| `--color-ink` (text) | `#1f1a14` | `#f1e6d0` |
| `--color-ink-muted` | `#5a4f42` | `#c2b49b` |
| `--color-line` | `#cbbd9f` | `#4a3a2b` |
| `--color-walnut` | `#5b3a24` | `#8a5a3a` |
| `--color-brass` (accent) | `#8a6420` | `#e0b45a` |
| `--color-brass-strong` | `#6e4f17` | `#f2c46d` |
| `--color-focus` | `#1d5c63` | `#f2c46d` |
| `--color-danger` | `#a3123a` | `#ff7a8f` |
| `--color-paper` (point paper sheet) | `#fbf7ee` | `#efe6d2` |

Fonts: `--font-display: "Fraunces Variable"`, `--font-sans: "Instrument Sans Variable"`, `--font-mono: "IBM Plex Mono"`, imported in `main.tsx` from Fontsource. Spacing stays on the 4 px unit; radii `--radius-sm 4px`, `--radius-md 8px`. Shadows are warm (`rgba(40, 24, 10, …)`). Card stock gets a subtle SVG noise (`feTurbulence`, data URI) as a background image, which is texture of one material, not a gradient (1.2).

`lib/theme.ts`: `resolveTheme(stored: string | null, systemDark: boolean): Theme` (Property 8), `useTheme()` returns `[theme, setTheme]`, writes `localStorage` and `data-theme`. `lib/reduced-motion.ts`: `useReducedMotion()` from `matchMedia`, with a module-level `prefersReducedMotion()` for non-React code.

The existing semantic classes (`.btn`, `.panel`, `.field`, `.note`, `.marker-*`, `.panel-empty` …) are kept, so panel tests do not change, and restyled in `@layer components` from the tokens. New components use Tailwind utilities.

### Studio shell (2.1 to 2.9)

`app.tsx` keeps every state, reducer and handler it has today. Its JSX becomes:

```
<Tooltip.Provider>
  <div class="studio" data-step>
    <TopBar … />                         header: brand, lede (2.1), setup chip, ⌘K, theme, menu
    <StepRail step status … />           nav[aria-label="Studio steps"]: 4 links, aria-current="step"
    <main class="studio-stage">
      <section data-step-view="design" hidden?>  Gallery, Motif, LoomSetup (side column)
      <section data-step-view="check"  hidden?>  FloatPanel, WeavePanel (side column)
      <div class="workbench" hidden={step is weave or cards}>  the one PointPaper Panel
      <section data-step-view="weave"  hidden?>  <WeaveStep …/>
      <section data-step-view="cards"  hidden?>  <CardsStep …/> + ExportPanel
    </main>
    <CommandPalette … />  <Toaster />  <Dialog shortcuts …/>
```

On wide screens Design is three columns (start column, workbench, setup column); Check is workbench plus the checks column; below 768 px everything stacks and the rail moves to a fixed bottom bar (2.8). `goToFloatCheck`, `focusProfile` and `focusGallery` call `setStep` first, then focus after the next frame (2.7).

`lib/view-transition.ts`: `changeView(update)` calls `document.startViewTransition(() => flushSync(update))` when available and motion is allowed, else `update()` (2.6). The CSS sets `::view-transition-old/new(root)` to a 220 ms cross-fade with a 6 px rise.

Shortcuts: the existing window `keydown` handler gains Alt+1..4 by `event.code` (`Digit1`…), skipped in text entry (2.9), and Ctrl/Cmd+K for the palette (3.1).

### Primitives (4.1 to 4.4)

- `ui/dialog.tsx`: same props as today. `Dialog.Root open onOpenChange`, `Dialog.Portal`, `Dialog.Overlay`, `Dialog.Content asChild` wrapping `<dialog open className="dialog">`. `onOpenAutoFocus` remembers the opener; `onCloseAutoFocus` prevents the default and focuses the opener if it can take focus, else the fallback (the tested behaviour). The footer Close button calls `onClose`.
- `ui/icon-button.tsx`: a `Button` with a lucide icon, `aria-label`, and a Radix Tooltip with the same text.
- `ui/info-tip.tsx`: a 28 px (44 px on touch) round "i" button with `aria-label="About <topic>"` and a Radix Popover with the explanation.
- `ui/toaster.tsx`: `<Toaster>` from sonner themed by tokens, and `notify(text, { sticky })` with `duration: Infinity` and a Dismiss action for sticky messages. `app.tsx`'s `say()` calls it.
- Menus: `shell/studio-menu.tsx` (Radix DropdownMenu: Theme, Sound, Tour, Shortcuts, Replay the story) and the loom speed menu.

### Command palette (3.1 to 3.5)

`shell/command-palette.tsx` uses `Command.Dialog` from cmdk (Radix Dialog inside) with a label, an input and groups: Steps, Gallery, Motif, Design, Export, View. It receives a `commands: readonly PaletteCommand[]` list built in `app.tsx` (`{ id, group, label, keywords?, shortcut?, disabled?, run }`). Disabled commands render with `aria-disabled` and do not run (3.3). Exports call the same `requestExport(kind)` the export panel exposes through a ref, so the gate applies (3.4). Focus return is Radix's (3.5).

### Less text and the tour (5.1 to 5.4)

Help paragraphs become `InfoTip`s; required notes stay (5.1). `lib/tour.ts` lazy-imports `driver.js` and its CSS, and runs at most eight stops on elements marked `data-tour="…"`: rail, gallery, point paper, Check rail item, Weave rail item, Cards rail item, palette button. The stop for a rail item only highlights it; the tour does not change Steps. The first Studio visit shows a toast with "Take the tour" once (`jacquard.tourOffered`) (5.4).

### Weave Step (6, 7, 8, 9)

`weave/weave-step.tsx` (entry chunk of the Studio, small) owns:
- the Loom_Model (`useMemo(buildLoomModel(planInUse, profile, yarns))`),
- the transport state (`lib/loom-transport.ts` reducer: `{ playing, speed, t }`, actions `play`, `pause`, `toggle`, `seek`, `step(±1)`, `setSpeed`, `reset`) — the reducer clamps `t`, and `step` lands on whole picks plus `0.999` (end of pick) when reduced motion is on,
- the readout (`aria-live="polite"`, updated once per pick),
- the card strip (`CardFace` SVGs of the strip from `cardStrip(model, pick)`),
- `<Suspense>` + error boundary around the lazy `weave/loom-scene.tsx`,
- the cloth view (`SimulatorPanel` with `initialZoom={8}`).

The playing clock lives in the scene: `useFrame` advances a ref `t += dt × speed × 2`, and calls `onPick(pick)` only when the whole part changes, so React renders the transport about twice a second, not sixty times. Without WebGL (`typeof WebGL2RenderingContext === "undefined"` or context creation fails), the Step uses a `setInterval` clock instead, so the transport, readout and card strip still work (6.6).

`weave/loom-scene.tsx` (lazy chunk, three + r3f + drei):

- `<Canvas dpr={[1, 2]} frameloop={playing && visible ? "always" : "demand"} camera={{ position: [5.2, 3.6, 6.4], fov: 38 }} shadows>` (15.3, 6.8). `visible` comes from the Step and `document.visibilityState`.
- Lights: a warm key light (Daylight: sun through a window; After hours: a candle point light with flicker), a dim fill, an ambient.
- `LoomFrame`: walnut boxes (uprights, top beam, breast beam, back beam), `meshStandardMaterial` walnut colour with roughness 0.7.
- `JacquardHead`: a box on the top beam, a brass `InstancedMesh` of hooks in rows of `hooksPerCardRow` (columns across x, slots in z), spare hooks dimmed (6.2). Each frame sets hook `y = base + lift × height(h)` (Property 1).
- `HarnessAndWarp`: one `LineSegments` geometry, per end two segments (hook to comber board, comber board to heddle) and one `LineSegments` for warp (back beam to heddle to fell). Positions update from the same heights; lifted ends raise the heddle.
- `CardChain`: a square card cylinder rotating a quarter turn in the advance Phase, and a pool of 12 card planes hanging in a loop; each plane has a `CanvasTexture` painted by `paintCard(canvas, card, profile)` from `cardRows`; when the pick changes the pool shifts by one and repaints only the new card (6.4).
- `Shuttle`: a boat shape (scaled capsule, wood) crossing the shed in the shuttle Phase, direction alternating by pick.
- `Reed`: a brass-edged bar rotating forward in the beat Phase.
- `Cloth`: a plane at the fell with a `DataTexture` (`hookCount × pickCount`, RGBA, nearest filter) filled by `clothTexture(model, woven)` (Property 2). Only the rows that change are rewritten.
- A `Html`-free scene: labels are DOM outside the Canvas. drei provides `ContactShadows`, `RoundedBox` and `Environment`-free lighting helpers only; no network assets.

`lib/loom-model.ts` (pure, Property 1 to 4):

```ts
export const PHASES = { advance: 0.2, lift: 0.35, shuttle: 0.7, beat: 0.85 } as const; // ends of each phase
export interface LoomModel {
  readonly pickCount: number; readonly hookCount: number; readonly positionCount: number;
  readonly cards: readonly Card[];          // buildCards
  readonly lifted: readonly (readonly boolean[])[]; // per card, decodeCards of that card alone, length hookCount
  readonly cloth: readonly (readonly ClothCell[])[]; // clothModel(plan, profile, yarns, "face")
}
export function buildLoomModel(plan, profile, yarns): Result<LoomModel, EngineError | ExportError>;
export type PhaseName = "advance" | "lift" | "shuttle" | "beat" | "settle";
export interface LoomFrame { pick; cardNumber; phase: PhaseName; progress /* 0..1 in phase */; lift /* 0..1 */; woven; shuttle /* -1..1 */; reed /* 0..1 */ }
export function loomFrame(model, t): LoomFrame;
export function hookHeight(model, frame, position): number; // 0 unless lifted[frame.pick][position]
export function raisedHooks(model, frame): number[];         // positions with height > 0
export function clothTexture(model, woven, target?: Uint8Array): Uint8Array; // RGBA, row = pick
export function cardStrip(model, pick, before, after): number[]; // card indices via nextCard
```

`lifted[i]` is computed by `decodeCards({ designWidth, repeatAcross, cards: [{ ...cards[i], index: 0, number: 1 }] }, profile)` so the "hole means lift or no lift" rule stays in the engine (9.7). Heights: `lift = ease((p - advance) / (lift - advance))` in the lift Phase, `1` in shuttle and beat, `1 - ease(…)` in settle, `0` in advance.

`lib/loom-sound.ts`: `createLoomSound()` lazy-imports `tone`, calls `Tone.start()`, builds a `MembraneSynth` (thud), a `NoiseSynth` through a band-pass `Filter` (whoosh), a `MetalSynth` (tick) and a short `NoiseSynth` + high-pass (clack), at low volume. `onPhase(phase)` plays one sound per Phase entry; `dispose()` on hide (8.1 to 8.4).

### Story (10.1 to 10.5)

`story/story.tsx` is plain React and CSS: a fixed "Skip to the studio" link, a hero (`h1` first line: "Punch cards are dead as a computing medium."), an SVG loom (`story/story-loom.tsx`, walnut frame, brass hooks, a card chain) and floating SVG cards, five `section`s with `h2` beats, and the final section with "Open the studio" and a gallery link. All text is in the DOM and readable without motion.

`story/story-motion.ts` (lazy) is loaded on idle when reduced motion is not requested: lenis for smooth scrolling (with `lenis.on("scroll", ScrollTrigger.update)` and gsap's ticker), and one ScrollTrigger timeline per beat: the room lightens from dark, the hooks rise in a wave, cards drift in on curved paths, the beat text fades and rises. The returned `dispose()` kills triggers and lenis on unmount. Keyboard scrolling stays native (lenis handles wheel and touch only by default) (10.4).

### Moments (11.1 to 11.6)

- `lib/reveal.ts`: `revealOrder(ends, picks): Int32Array` (pick-major from pick 0) and `revealedCount(elapsed, total, duration)`. `PointPaper` gets an optional `reveal: { key, design }`; while a reveal runs, `drawPointPaper` receives a `revealed` count and paints unrevealed cells in the paper colour; each newly placed batch gets a short brass flash. Pointer down, key down, wheel or a Step change end it (Property 5).
- Violation pulse: violation and flip marks move to an overlay canvas over the point paper (`.paper-marks`); CSS `@keyframes mark-pulse` animates its opacity between 1 and 0.55, `prefers-reduced-motion` turns it off. Outline and triangle stay in every frame of the pulse (11.2).
- `lib/flip-sequence.ts`: `flipSchedule(flips, duration)` gives each flip its start time in engine order; `flipsShownAt(schedule, elapsed)` returns the prefix (Property 6). `PointPaper` draws that prefix of diamonds on the overlay.
- Card punching: `CardFace` with `punch` animates each hole's scale from 0 to 1 with `motion`, delayed by row (11.4).

### Cloth view (12.1 to 12.4)

`lib/draw-threads.ts`: `drawThreadRows(context, cells, cell, fromPick, toPick, light)` uses only `fillRect` and `fillStyle` (the same `ClothContext` as `drawClothRows`), so it runs on the test contexts:

1. Base: one `fillRect` per cell in the cell's `colour` (Property 7).
2. Thread body: for a warp cell, a vertical thread one cell wide minus a gap, with a lit band on the light side and a shaded band on the other; for a weft run, one horizontal thread across the run.
3. Dive shadows: where the cell above or below (warp) or left or right (weft) has the other thread on top, a dark band at that edge, so the thread goes under; along a float no dive is drawn.
4. Light: `light` is `"day"` or `"candle"` (After hours) and only changes the tint of the highlight band.

`SimulatorPanel` uses `drawThreadRows` from 6 px per cell and `drawClothRows` below; it gains an optional `initialZoom` and wraps the viewport in `.cloth-flip`, which plays a `rotateY` keyframe when `side` changes (12.3).

### Cards Step (13.1 to 13.4)

- `cards/card-face.tsx`: an SVG card from `cardRows`: card-stock fill with the noise texture, rounded corners, two lacing holes at each end, the card number, the hole grid with punched holes in the room colour (so the background shows through) and unpunched positions as faint rings.
- `cards/card-chain.tsx`: up to 24 cards around the selected one, fanned with a small rotation and overlap, a lace line through the lacing holes; `role="listbox"` with `aria-activedescendant`, arrow keys and Home/End move the selection; the selected card is drawn large beside the chain with its number and punched count (from the card).
- `cards/print-sheet.tsx`: rendered on `beforeprint` (`flushSync`) and by "Print cards"; every card in lacing order, the untested-format note and the profile summary. `@media print` hides `.studio` chrome (13.3).
- `lib/card-chain.ts`: `chainWindow(selected, cardCount, size)` with `nextCard` wrap-around.

### Performance (15.1 to 15.3)

Dynamic imports give separate chunks: Story, Studio, LoomScene, story-motion, loom-sound, tour. A build test checks that the entry chunk does not contain `three`, `gsap`, `lenis`, `tone` or `driver.js` identifiers. Lighthouse runs through the Chrome DevTools MCP `lighthouse_audit` on `vite preview`.

## Correctness Properties

Each property has its own property test task. Tests use fast-check with fixed seeds and `numRuns: 100`, tagged `Feature: studio-experience, Property N: <title>`.

### Property 1: The loom lifts exactly the hooks the current card punches

For a random design, weaves and profile (including `holeMeans` `lift` and `noLift`, spare hooks, repeat across on and off), the engine's plan and a random Loom_Time `t`: in the shuttle Phase the positions with `hookHeight === 1` equal `{ h < hookCount : card.punched[h] !== (holeMeans === "noLift") }` for the current card, which equals `{ h : plan.lifts[pick][h] }`; at any Phase every position with `hookHeight > 0` is in that set; spare positions are always 0.
**Validates: Requirements 9.1, 9.3, 6.2, 6.3**

### Property 2: Cloth growth matches the lift plan pick for pick

For the same inputs and any `t1 ≤ t2`: `woven(t1) ≤ woven(t2)`; `woven(t)` is `pick` before the end of the beat and `pick + 1` after it; `woven(pickCount) = pickCount`. `clothTexture(model, woven)` has, for every pick below `woven`, the RGBA of `clothModel`'s colour for every hook, and alpha 0 for every pick at or above `woven`; on a profile with `wovenFaceDown` false, a texel shows the warp colour exactly when `plan.lifts[pick][hook]`.
**Validates: Requirements 9.4, 9.5, 6.3**

### Property 3: Loom time maps to card and phase

For any model and any finite `t` (including negatives and values past `pickCount`): `pick = min(floor(clamp(t)), pickCount - 1)`, `cardNumber = pick + 1`, the Phase names follow the order advance, lift, shuttle, beat, settle as the fraction grows, and `progress` is in `[0, 1]`.
**Validates: Requirements 9.2, 7.2**

### Property 4: The card strip follows the lacing chain

For any `pickCount`, `pick`, `before` and `after`: `cardStrip` returns `before + 1 + after` indices (capped at `pickCount`, no repeats), the middle one is `pick`, and each index is the engine's `nextCard` of the one before it.
**Validates: Requirements 9.6, 6.4, 13.2**

### Property 5: The motif reveal places every cell once

For any `ends`, `picks` and elapsed times: `revealOrder` is a permutation of all `ends × picks` cells in pick-major order from pick 0; `revealedCount` is non-decreasing in elapsed time, 0 at the start and `ends × picks` at the duration or later.
**Validates: Requirements 11.1, 11.5**

### Property 6: Auto-fix placement shows the engine's flips in order

For the engine's `autoFix` output on a random plan with violations: the schedule has one entry per flip in the engine's order, start times are non-decreasing and within the duration, the flips shown at any time are a prefix of the engine's list, and at the duration all flips are shown.
**Validates: Requirements 11.3**

### Property 7: The thread renderer draws each cell's top thread in its clothModel colour

For a random plan, yarns, side, zoom from 6 to 16 and light: in the calls recorded by a fake context, the first `fillRect` covering each cell's centre uses that cell's `clothModel` colour, and every call stays inside the canvas.
**Validates: Requirements 12.1, 12.2**

### Property 8: Theme resolution

For any stored value and system preference: a stored `daylight` or `after-hours` wins; any other stored value (missing, empty, unknown) falls back to `after-hours` when the system is dark and `daylight` otherwise.
**Validates: Requirements 1.4**

### Property 9: Route round trip

For every Step, `parseHash(hrefFor({ page: "studio", step }))` returns that Step; `#/` and the empty hash give the Story; `#/studio` and an unknown Step give Design; any other string gives a valid Route.
**Validates: Requirements 2.3, 10.5**

## Error Handling

- `buildLoomModel` returns the engine or export error unchanged; the Weave Step shows it with "Go to the float check".
- The scene's error boundary shows "The 3D loom could not start on this device. The transport, cards and cloth below still work." (6.6).
- A failed lazy chunk (offline) shows a retry button in the Step.
- `tone` failing to load or start turns the sound toggle off with a toast.
- The tour failing to load shows a toast; nothing else changes.

## Testing Strategy

- Property tests for Properties 1 to 9 in `apps/web/test/*.property.test.ts`.
- Component tests: Step_Rail (aria-current, hash, Alt+digit), command palette (opens with Ctrl+K, disabled commands do not run, export goes through the gate), Dialog (existing test unchanged), Weave Step without WebGL (transport, readout, card strip, empty states), Cards Step (selection by keys, print sheet renders every card), Story (first line, skip link first, beats as headings, framing scans), theme toggle (stored choice).
- Existing App tests get the `openStep` helper (16.3).
- Build test: chunk contents (15.1).
- Visual checks with the Chrome DevTools MCP server (17.1), Lighthouse (15.2), `design-reviewer` per wave (17.2), `weave-auditor` at the end (standing orders).
