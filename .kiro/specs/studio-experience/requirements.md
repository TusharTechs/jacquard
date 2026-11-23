# Requirements Document

## Introduction

Scope: the polish phase ("phase-polish"). JACQUARD's engine, motif and export packages are finished; the web app is a working three-column form. This feature turns `apps/web` into a studio with a story: an opening scroll story about the Jacquard loom, a four-step studio (Design, Check, Weave, Cards), a 3D loom driven by the real lift plan, motion at the moments that matter, a thread-level cloth view and realistic punch cards. The story is Resurrection: the 1804 Jacquard loom comes back to life.

Design direction, "the loom room": materials, not gradients (warm card stock, walnut, brass, real thread colours); a display serif, a clean sans and a monospace; two themes, Daylight and After hours.

Code locations: `apps/web` only, plus the steering file `.kiro/steering/design-language.md`. `packages/engine`, `packages/export`, `packages/motif`, `packages/mcp` and `backend` do not change. Acceptance criteria are cited as `N.M`.

## Glossary

- **Studio**: the app at `#/studio`, with the Step_Rail and four Steps.
- **Step**: one of `design`, `check`, `weave`, `cards`, shown one at a time.
- **Step_Rail**: the navigation between Steps.
- **Story**: the opening page at `#/` (the landing).
- **Plan_In_Use**: the lift plan the simulator and exports use today: the fixed plan when an auto-fix result is current, otherwise the design's plan (simulate-and-export 2.4, 6.3).
- **Loom_Model**: a pure value built from Plan_In_Use, the loom profile and the yarn colours, through the engine's `buildCards` and `decodeCards` and the export package's `clothModel`.
- **Loom_Time**: a number `t` in `[0, pickCount]`. The whole part is the current pick; the fraction is the Phase within that pick.
- **Phase**: the stages of one pick in order: advance (the card chain moves one card), lift (the hooks the card selects rise), shuttle (the weft crosses the open shed), beat (the reed beats the pick into the cloth), settle (the hooks fall).
- **Loom_Frame**: what the 3D loom shows at a Loom_Time: current card, Phase, the height of every hook, shuttle and reed positions, and the number of woven picks.
- **Theme**: `daylight` or `after-hours`.
- **Moment**: a short animation tied to an event: a motif arriving, violations, auto-fix, cards punching.

## Requirements

### Requirement 1: Materials, type and themes

**User Story:** As a judge or a designer, I want the app to look like a craft studio, so that the product feels intentional and the design colours read first.

#### Acceptance Criteria

1. THE web app SHALL define its colours, type, radii, shadows and spacing as Tailwind v4 design tokens (`@theme`) and CSS custom properties, and SHALL style every component from those tokens.
2. THE palette SHALL use material colours (card stock, walnut, brass, ink, thread colours) and SHALL NOT use decorative gradients between hues, glass blur effects or purple accents. Lighting shading of a single material (a darker and lighter tone of the same colour) is allowed.
3. THE web app SHALL use a display serif for headings, a sans-serif for interface text and a monospace for numbers (hook, end, pick, card number, counts), each self-hosted through Fontsource packages with no request to a font CDN.
4. THE web app SHALL offer two Themes: Daylight (light, default) and After hours (dark, warm candle light). WHEN the user has not chosen a Theme, THE app SHALL follow `prefers-color-scheme`; WHEN the user chooses one, THE app SHALL keep that choice in `localStorage` and apply it before first paint.
5. IN both Themes, THE text and control colours SHALL meet WCAG AA contrast (4.5:1 for body text, 3:1 for large text and focus rings).
6. THE point paper SHALL keep a light paper surface in both Themes, so region colours read the same.

### Requirement 2: Studio shell

**User Story:** As a designer, I want four clear steps instead of one long form, so that I see only what the current step needs.

#### Acceptance Criteria

1. THE Studio SHALL show a top bar with the product name, a one-line framing sentence whose first sentence says that punch cards are dead as a computing medium and which says the tool helps designers and card punchers, the loom setup summary, a command palette button, a Theme control and a menu.
2. THE Studio SHALL show a Step_Rail with the Steps Design, Check, Weave and Cards in that order, each with an icon, a label and a status (for Check: the violation count or "no long floats"), and SHALL mark the current Step with `aria-current="step"`.
3. THE Step SHALL be part of the URL (`#/studio/<step>`), so Back, Forward and reload return to it; `#/studio` opens Design.
4. Steps that are not shown SHALL stay mounted and hidden (the `hidden` attribute), so their form state, zoom and scroll survive a Step change.
5. THE Design Step SHALL hold the gallery, the motif input, the loom setup and the point paper; THE Check Step SHALL hold the point paper, the float check and the weave per region; THE Weave Step SHALL hold the 3D loom and the cloth view; THE Cards Step SHALL hold the card chain and the exports. THE point paper SHALL be one instance shared by Design and Check.
6. WHEN the Step changes and reduced motion is not requested, THE change SHALL use a view transition (the View Transitions API where available) of at most 300 ms that never blocks input; otherwise the change SHALL be instant.
7. Every existing action SHALL remain reachable. An action in one Step that targets another (for example "Go to the float check" from the point paper, "Choose a larger profile" from the float check) SHALL switch to that Step and move focus as it does today.
8. AT widths below 768 px, THE Step_Rail SHALL become a bottom bar with 44 px targets, and panels SHALL stack (design-language.md, mobile state).
9. THE keyboard shortcuts Alt+1 to Alt+4 SHALL select the Steps in order, and SHALL NOT fire while focus is in a text entry.

### Requirement 3: Command palette

**User Story:** As a frequent user, I want one keyboard entry point to every action, so that I do not hunt through panels.

#### Acceptance Criteria

1. WHEN the user presses Ctrl+K or Cmd+K, or activates the top bar button, THE Studio SHALL open a command palette built with `cmdk` in a modal dialog with a labelled search input.
2. THE palette SHALL offer at least: go to each Step; open each gallery example; describe a motif; upload a sketch; start from a blank grid; run auto-fix; undo; redo; each export (Cards PDF, Cards SVG, Point paper SVG, WIF); switch Theme; turn sound on or off; start the guided tour; show the point paper shortcuts; replay the Story.
3. A command that cannot run now (for example auto-fix without violations, undo with nothing to undo, an export with no lift plan) SHALL be shown disabled or left out, never run silently.
4. An export from the palette SHALL go through the same violation gate as the export panel (simulate-and-export 6.2).
5. Closing the palette SHALL return focus to the element focused before it opened.

### Requirement 4: Shared primitives

**User Story:** As a maintainer, I want one set of accessible primitives, so that every dialog, menu, tooltip and toast behaves the same.

#### Acceptance Criteria

1. Dialogs SHALL be built on `@radix-ui/react-dialog`: focus trapped while open, Escape closes, focus returns to the opener or, when the opener is gone or disabled, to the given fallback (existing Dialog behaviour).
2. Menus SHALL be built on `@radix-ui/react-dropdown-menu`, tooltips on icon buttons on `@radix-ui/react-tooltip`, and info tips on `@radix-ui/react-popover`.
3. Toasts SHALL use `sonner`, in a polite live region; a sticky message (one the user may act on, such as Undo after a resize) SHALL stay until dismissed, and every toast SHALL have a dismiss control.
4. Icons SHALL come from `lucide-react`; an icon-only control SHALL have an accessible name and a tooltip with the same text.

### Requirement 5: Less text on screen

**User Story:** As a first-time visitor, I want short labels and help on demand, so that the screen is calm and I can still learn the terms.

#### Acceptance Criteria

1. Help paragraphs that explain a control SHALL become a short label plus an info tip (a button that opens the explanation); required notes stay visible: the untested card format, the WIF `[to verify]` note, the simulation note, suggestion and stand-in labels, empty, loading and error states.
2. Weaving terms (end, pick, float, lift plan, shaft) SHALL keep their tooltips with the wording from `weaving-domain.md`.
3. THE Studio SHALL offer an optional guided tour of at most eight stops and about 30 seconds, built with `driver.js`, that covers the Step_Rail, the gallery, the point paper, each Step and the command palette.
4. THE tour SHALL never start by itself. On the first Studio visit a toast SHALL offer it once; afterwards it is in the menu and the palette. Escape or Close SHALL end it at any stop.

### Requirement 6: 3D loom scene

**User Story:** As a judge, I want to watch the loom weave my design, so that I see the punch cards working as a program.

#### Acceptance Criteria

1. THE Weave Step SHALL show a stylised Jacquard loom built with `three`, `@react-three/fiber` and `@react-three/drei`: a walnut frame, a Jacquard head with brass hooks, a card chain on a card cylinder, warp ends from the back beam to the cloth, a shuttle and a reed, and the cloth on the front.
2. THE hooks SHALL be laid out like the card: one hook per card position in rows of `hooksPerCardRow`, so the punched pattern of the current card and the raised hooks line up. Spare hooks SHALL be shown and SHALL never rise.
3. AT every Loom_Time, the hooks and warp ends that are raised SHALL be exactly those of the current card's lifted hooks (Requirement 9), and the cloth SHALL show exactly the woven picks of the Loom_Frame.
4. THE card chain SHALL show the current card on the cylinder, face out, with its punched holes, and the neighbouring cards of the chain in lacing order, wrapping from the last card to card 1 (engine `nextCard`).
5. THE scene SHALL say that it is a stylised loom, not to scale and not a model of a working loom, and that the card format has not been tested on a working loom.
6. IF WebGL is not available or the scene fails, THEN THE Weave Step SHALL show a plain message and keep the transport, the current card and the cloth view working.
7. THE three.js code SHALL be loaded only when the Weave Step is first opened (or prefetched when the pointer rests on the Weave rail item), as its own chunk.
8. WHILE the Weave Step is hidden or the tab is in the background, THE scene SHALL not render frames.

### Requirement 7: Loom transport and current card

**User Story:** As a designer, I want to play, pause and scrub the weaving, so that I can study any pick.

#### Acceptance Criteria

1. THE Weave Step SHALL offer Play/Pause, a scrubber over the picks, step back and step forward by one pick, and speeds of 0.5x, 1x, 2x and 4x, all keyboard operable, with Space toggling play while focus is on the transport.
2. THE Weave Step SHALL show, in sync with the scene, the current card number in lacing order (card `n` weaves pick `n - 1`), the pick, the count of lifted hooks, and the current card drawn flat with its holes, highlighted in a strip of neighbouring cards.
3. THE transport SHALL use the Plan_In_Use and SHALL say which plan it uses (fixed or design), as the simulator does. WHEN the plan changes, THE loom SHALL restart from pick 0 paused.
4. WHILE the float check reports violations and no fixed plan is current, THE Weave Step SHALL show the violation count with a link to the Check Step; it SHALL still weave.
5. WHEN reduced motion is requested, THE loom SHALL not play on its own and each step SHALL jump to the end of a pick without in-between motion.
6. WHEN there is no Plan_In_Use, THE Weave Step SHALL show the same empty states as the simulator (blank grid, or an engine error with "Go to the float check").

### Requirement 8: Loom sound

**User Story:** As a judge watching the demo, I want the loom to sound like a machine, so that it feels alive.

#### Acceptance Criteria

1. THE loom SHALL make procedural sounds with `tone` (no audio files): a card clack on advance, a light metallic tick on lift, a soft whoosh for the shuttle and a low thud on the beat.
2. Sound SHALL start muted on every visit and SHALL only start after the user turns it on; `tone` SHALL be loaded only then.
3. THE sound control SHALL be a labelled toggle with its state (`aria-pressed`), in the Weave transport and in the command palette.
4. Sound SHALL follow play, pause and speed, SHALL limit itself to one sound of each kind per pick, and SHALL stop when the Weave Step is hidden.

### Requirement 9: Loom model

**User Story:** As a maintainer, I want the loom animation to come from the engine's cards, so that the 3D view never shows a lift the cards do not make.

#### Acceptance Criteria

1. `buildLoomModel(plan, profile, yarns)` SHALL return the card set from the engine's `buildCards`, for each card the lifted figuring hooks read back through the engine's `decodeCards`, and the face cloth from `clothModel`; any engine or export error SHALL be returned unchanged.
2. `loomFrame(model, t)` SHALL clamp `t` to `[0, pickCount]`, and SHALL return the current pick `min(floor(t), pickCount - 1)`, the card number `pick + 1`, and the Phase.
3. THE height of hook `h` in a Loom_Frame SHALL be 0 when `h` is not lifted by the current card, and SHALL be 1 (fully raised) for every lifted hook throughout the shuttle Phase; spare positions SHALL always be 0. So the set of raised hooks during the shuttle equals the set of hooks the current card lifts: `punched[h]` when `holeMeans` is `lift`, `!punched[h]` when it is `noLift`, which equals `plan.lifts[pick][h]`.
4. THE number of woven picks SHALL be `pick` before the end of the beat Phase of `pick` and `pick + 1` from then on, and `pickCount` at `t = pickCount`; it SHALL never decrease as `t` grows.
5. THE cloth texture for a Loom_Frame SHALL hold, for every woven pick, the colour of `clothModel`'s cell for every hook, and SHALL be transparent for picks not yet woven.
6. THE card strip for a pick SHALL list the neighbouring card indices in lacing order with the engine's `nextCard`, wrapping round.
7. These functions SHALL be pure and deterministic and SHALL contain no weaving rule of their own: lifts come from the engine's cards and colours from `clothModel`.

### Requirement 10: Opening story

**User Story:** As a judge opening the link, I want a short story before the tool, so that I understand why punch cards matter.

#### Acceptance Criteria

1. `#/` SHALL show the Story: a dark loom room, the machine waking, punch cards drifting in, then five beats: 1804 Jacquard; punch cards became the first programs; computers abandoned them; handlooms in India never did; now AI writes them. It SHALL end on an "Open the studio" button.
2. THE first line of the Story SHALL say that punch cards are dead as a computing medium. Copy SHALL follow `product.md`: assist, never replace; the only figure is the handloom census count (about 35 lakh workers, 2019-20) with its source named; the card format is a configurable loom profile not tested on a working loom.
3. THE scroll motion SHALL use `gsap` with ScrollTrigger and `lenis` smooth scrolling, loaded only on the Story and only when reduced motion is not requested; with reduced motion or without JavaScript motion, THE Story SHALL be a readable static page.
4. THE Story SHALL be skippable: a "Skip to the studio" link SHALL be the first focusable element and visible on focus and on screen; each beat SHALL be a section with a heading; the Story SHALL be fully keyboard operable (Tab, Page Down, Space, arrow keys).
5. "Open the studio" SHALL go to `#/studio/design`. THE Studio menu and palette SHALL offer "Replay the story".

### Requirement 11: Moments with motion

**User Story:** As a designer, I want the important events to be visible, so that I notice what changed.

#### Acceptance Criteria

1. WHEN a motif or gallery example replaces the grid, THE point paper SHALL reveal it cell by cell in a fixed order over at most 900 ms, every cell placed exactly once; any edit, scroll or Step change SHALL finish the reveal at once.
2. WHILE the point paper shows float violations, THE violation marks SHALL pulse gently (opacity), keeping their outline and triangle, so colour and shape still mark them when the pulse is off.
3. WHEN auto-fix succeeds, THE point paper SHALL show the auto-fix changes and place the engine's flips one by one in the engine's order over at most 1.5 s, each flip once, ending with all flips shown.
4. WHEN the Cards Step shows a card for the first time, THE card SHALL punch its holes row by row over at most 800 ms.
5. WHEN reduced motion is requested, every Moment SHALL show its end state at once.
6. Motion SHALL use the `motion` library for component animation and `requestAnimationFrame` for canvas animation, and SHALL never block input.

### Requirement 12: Cloth view

**User Story:** As a designer, I want the simulated cloth to look like threads, so that I can see twill lines and satin smoothness.

#### Acceptance Criteria

1. FROM a zoom of 6 px per cell, THE cloth view SHALL draw each cell as a thread with a lit side and a shaded side, a weft run on the face as one thread passing over the ends it floats over, and a shadow where a thread dives under its neighbour, so twill diagonals and satin faces read as texture. Below 6 px it SHALL keep the current drawing.
2. THE colour of the top thread of each cell SHALL be the colour `clothModel` gives that cell.
3. Switching between face and back SHALL turn the cloth over with a 3D flip (at most 500 ms; instant with reduced motion); the side state changes at once.
4. THE Weave Step SHALL open the cloth view at a thread-level zoom; the existing simulator behaviour (2.1 to 2.5 of simulate-and-export) SHALL stay.

### Requirement 13: Cards Step

**User Story:** As a card puncher, I want to see the cards as cards, so that I can check the set before printing.

#### Acceptance Criteria

1. THE Cards Step SHALL draw the card set from the engine's `buildCards` and `cardRows`: card-stock surfaces, punched holes showing the background through, lacing holes at both ends, and the card number at the numbered end.
2. THE cards SHALL appear as a fanned chain in lacing order; the user SHALL be able to select a card by click, tap or arrow keys and see it large, with its number and its punched count.
3. A print stylesheet SHALL print the whole card set (every card, numbered, in lacing order) with the untested-format note and no Studio chrome, from a "Print cards" button and from the browser's print command.
4. THE export panel SHALL stay in the Cards Step with its gate, notes and states unchanged.

### Requirement 14: Accessibility and reduced motion

**User Story:** As a keyboard or screen reader user, I want the new studio to work as well as the old form.

#### Acceptance Criteria

1. Every control SHALL keep a visible label or an accessible name, a keyboard path and a visible focus ring in both Themes.
2. Float violations SHALL keep colour plus shape (outline and triangle) on the point paper and a text list in the float check.
3. THE 3D loom and the Story SHALL have text equivalents: the Loom_Frame readout in a polite live region (current card, pick, lifted hooks), and the Story beats as headings and paragraphs.
4. `prefers-reduced-motion: reduce` SHALL turn off smooth scrolling, scroll-driven motion, view transitions, pulses, reveals and autoplay everywhere.
5. Hit targets SHALL be at least 44 px on touch.

### Requirement 15: Performance

**User Story:** As a judge on a mid-range laptop, I want the first screen fast, so that the demo never stalls.

#### Acceptance Criteria

1. `three`, `@react-three/fiber`, `@react-three/drei`, `gsap`, `lenis`, `tone` and `driver.js` SHALL NOT be in the entry chunk; each SHALL load in a chunk of its own feature (Weave, Story motion, sound, tour).
2. Lighthouse on the production build (`vite build` then `vite preview`) SHALL score at least 90 for Performance, Accessibility and Best Practices on the Story and on the Studio.
3. THE 3D loom SHALL use instancing for hooks, warp ends and cards, SHALL cap the pixel ratio at 2, and SHALL render on demand while paused.

### Requirement 16: Boundaries and dependencies

**User Story:** As a maintainer, I want the polish to stay in the web app, so that the verified engine is untouched.

#### Acceptance Criteria

1. Files under `packages/engine`, `packages/export`, `packages/motif`, `packages/mcp` and `backend` SHALL NOT change.
2. Every new dependency SHALL be pinned to an exact version published at least 14 days before it was added (on or before 2026-11-09 for this phase).
3. All existing tests SHALL keep passing. Studio-level tests that render the whole App MAY add steps that open a Step before they act, and the document-order test MAY check the Step order; no assertion about behaviour or copy SHALL be removed or loosened.
4. No new weaving rule SHALL be written in `apps/web`; the web app calls the engine and the export package.

### Requirement 17: Visual verification

**User Story:** As the builder, I want proof that every screen looks right, so that nothing ships unseen.

#### Acceptance Criteria

1. Each wave that changes the UI SHALL be checked through the Chrome DevTools MCP server at 1440x900 and 390x844 in both Themes, and the final set of screenshots SHALL be saved under `media/polish/`.
2. THE `design-reviewer` agent SHALL review the UI after each wave, and its findings SHALL be fixed or answered in the journal.

## Labels

Same labels as the weave-engine spec. No new loom fact is introduced. The 3D loom is stylised; its hook layout follows the card layout of the profile (`cardRows`), whose row placement stays `[to verify]`.

## Decision log

Gap analysis run by the agent under the standing orders in `.kiro/steering/autopilot.md`, using `PLAN.md`, the steering files and the existing code as the source of truth. No item contradicts `PLAN.md` or a `[sourced]` loom fact.

| Q | Answer | Label |
|---|---|---|
| `design-language.md` says motion under 200 ms, one sans-serif, and a Halloween nod only in the gallery. The brief asks for longer Moments, a display serif and an After hours theme. | The brief is the user's instruction for this phase. `design-language.md` is updated: Moments up to 1.5 s that never block input and are skippable, interface transitions up to 300 ms, a display serif for headings, and After hours as the Kiroween nod. Reduced motion still turns every animation off. | [decision] |
| The existing App tests expect every panel on one page. With Steps, hidden panels are out of the accessibility tree. | Tests that render the whole App get a helper that opens the Step first (16.3). Assertions stay. The document-order test checks the Step order and the order inside each Step. Each changed test is listed in the journal. Panel component tests do not change. | [decision] |
| Keep hidden Steps mounted or unmount them? | Mounted with `hidden`, so the motif prompt, zoom, scroll and export state survive (2.4). The three.js chunk mounts on the first Weave visit and stays. | [decision] |
| Routing library? | None. A small hash router (`#/`, `#/studio/<step>`) in `lib/route.ts`; the hash works on static hosting without rewrites. | [decision] |
| Where is the first screen for a judge? | `#/` is the Story with "Skip to the studio" and "Open the studio" on the first screen. The studio opens on Design with the gallery first, as PLAN.md asks ("a judge sees results in ten seconds"). | [decision] |
| Radix Dialog and the existing native `<dialog>` contract (tests query `dialog[open]`). | The shared Dialog keeps its props and renders Radix `Dialog.Content` as a `<dialog open>` element (`asChild`), so semantics, focus trap and Escape come from Radix and the element stays a dialog. Focus return to the opener or the fallback is kept in `onCloseAutoFocus`. | [decision] |
| Term tooltips: Radix Tooltip ignores touch. | `Term` keeps its own hover, focus, tap and Escape behaviour and is restyled. Radix Tooltip is used for icon-button labels, Radix Popover for info tips (tap works). | [decision] |
| cmdk in the entry chunk or lazy? | Entry chunk: it is small and must open on the first key press. | [decision] |
| `@react-three/postprocessing`? | Not used. Bloom is replaced by emissive materials and a warm light, to keep the Weave chunk small (15.1). | [decision] |
| Fonts | Fraunces (variable, display serif), Instrument Sans (variable, interface), IBM Plex Mono 400 and 500 (numbers), from Fontsource, latin subsets loaded by `unicode-range`. | [decision] |
| Versions (16.2, cutoff 2026-11-09) | three 0.187.0, @types/three 0.187.0, @react-three/fiber 9.8.2, @react-three/drei 10.7.9, motion 14.11.1 (14.14.0 is from 2026-11-13), gsap 3.15.1, @gsap/react 2.1.2, lenis 1.3.27, tone 15.1.22, cmdk 1.1.1, sonner 2.0.8, driver.js 1.11.0 (1.14.0 is from 2026-11-13), lucide-react 1.70.0 (1.78.0 is from today), tailwindcss and @tailwindcss/vite 4.3.5, @radix-ui/react-dialog 1.3.1, -dropdown-menu 2.2.1, -popover 1.3.1, -slider 1.6.1, -tooltip 1.4.1, Fontsource 5.3.0. Publish dates read with `npm view <name> time` on 2026-11-23. | [decision] |
| Phase timing inside one pick | advance 0 to 0.2, lift 0.2 to 0.35, shuttle 0.35 to 0.7, beat 0.7 to 0.85, settle 0.85 to 1. Woven picks increase at the end of the beat (0.85). | [decision] |
| Hook heights outside the shuttle Phase | Rise with an ease over the lift Phase and fall over the settle Phase; 0 during advance. Only lifted hooks move (9.3). | [decision] |
| Which side does the 3D cloth show? | The face, from `clothModel(..., "face")`, which already follows `wovenFaceDown`. | [decision] |
| Spare hooks and idle hooks | Spare hooks are drawn dimmed and never rise (the engine never lifts them). Idle hooks follow the plan, which never lifts them when repeat across is off. | [decision] |
| Plan with violations in the Weave Step | It weaves (the cloth shows the long floats); a status line counts violations and links to Check (7.4). Blocking would hide the problem the simulation is meant to show. | [decision] |
| Default speed and autoplay | 1x is 2 picks per second. The loom starts paused at pick 0; the user presses Play. | [decision] |
| Sound persistence | Not persisted. Muted on every visit (8.2), because browsers need a gesture to start audio anyway. | [decision] |
| Story facts | 1804 and "punch cards were the first programs" are the PLAN.md pitch. The India beat uses the census figure from `research/05-prior-art-ideas-1-4.md` (4th All India Handloom Census, 2019-20) and says Jacquard looms are still used in Varanasi and Kanchipuram (same file, item 2). No other date or number. | [decision] |
| Reveal order for a new motif | Pick 0 upward, end 0 rightward inside a pick (the order cloth is woven), batched by pick so a 400-pick grid still finishes in the time limit. | [decision] |
| Order of auto-fix placement | The engine's `flips` order, unchanged (11.3). | [decision] |
| Card chain size | The chain draws up to 24 cards around the selected one; printing draws every card. | [decision] |
| Print | `@media print` hides the Studio and shows a print-only sheet of all cards, rendered on `beforeprint` and from the "Print cards" button. The PDF export stays the precise output. | [decision] |
| Screenshots in git | PNGs under `media/polish/` are committed only if the set is under 8 MB; otherwise the folder is ignored and the journal says so. | [decision] |
| Tour storage | `localStorage` key `jacquard.tourOffered`; the Theme key is `jacquard.theme`. | [decision] |
