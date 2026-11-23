# Requirements Document

## Introduction

Scope: the polish phase ("phase-polish"). The engine, motif and export packages are finished; the web app is a working three-column form with long help paragraphs. This feature turns `apps/web` into one clear flow with one memorable showpiece:

- a clean studio with a step rail, Design → Check → Weave → Cards;
- the showpiece: a 3D Jacquard loom in the Weave step, driven by the real lift plan;
- a short opening (one screen, under 4 seconds, shown once): the Kiroween nod;
- motion only where it explains something;
- realistic punch cards and a print stylesheet in the Cards step.

Organisers' guidance this is designed against: "simple, focused solutions that tackle a real problem", "a clean interface and an intuitive user experience", "wickedly creative that actually works". So nothing decorative that adds steps or text.

Out of scope (the user said not to build them): a scrolling story landing page, a second theme, a guided tour, a new cloth renderer. The existing 2D cloth simulation stays, in the Check step.

Code locations: `apps/web` only, plus `.kiro/steering/design-language.md`. `packages/engine`, `packages/export`, `packages/motif`, `packages/mcp` and `backend` do not change. Acceptance criteria are cited as `N.M`.

## Glossary

- **Studio**: the app, with the Step_Rail and four Steps.
- **Step**: one of `design`, `check`, `weave`, `cards`, shown one at a time.
- **Step_Rail**: the navigation between Steps.
- **Plan_In_Use**: the lift plan the simulator and exports use: the fixed plan when an auto-fix result is current, otherwise the design's plan (simulate-and-export 2.4, 6.3).
- **Loom_Model**: a pure value built from Plan_In_Use, the loom profile and the yarn colours through the engine's `buildCards` and `decodeCards` and the export package's `clothModel`.
- **Loom_Time**: a number `t` in `[0, pickCount]`. The whole part is the current pick; the fraction is the Phase within that pick.
- **Phase**: the stages of one pick, in order: advance (the card chain moves one card), lift (the hooks the card selects rise), shuttle (the weft crosses the open shed), beat (the reed beats the pick in), settle (the hooks fall).
- **Loom_Frame**: what the 3D loom shows at a Loom_Time: the current card, the Phase, the height of every hook, the shuttle and reed positions, and the number of woven picks.
- **Opening**: the one-screen introduction shown on the first visit.
- **Hint**: a short label's info button that shows a tooltip with the explanation that used to be a help paragraph.
- **Moment**: a short animation that explains an event.

## Requirements

### Requirement 1: Look

**User Story:** As a judge or a designer, I want the app to look like a craft studio, so that it feels intentional and the design colours read first.

#### Acceptance Criteria

1. THE web app SHALL define colours, type, radii, shadows and spacing as Tailwind v4 design tokens (`@theme`) and CSS custom properties, and SHALL style every component from them.
2. THE palette SHALL be materials: card stock, walnut, brass, ink and the user's thread colours. THE app SHALL NOT use decorative gradients, glass blur effects or purple accents. Shading of one material (a lighter and darker tone of the same colour) is allowed.
3. THE app SHALL use a display serif for headings, a sans-serif for interface text and a monospace for numbers (hook, end, pick, card number, counts), each self-hosted through Fontsource with no request to a font CDN.
4. THE app SHALL have one theme. Text and control colours SHALL meet WCAG AA (4.5:1 body text, 3:1 large text and focus rings).

### Requirement 2: Studio shell

**User Story:** As a designer, I want four clear steps instead of one long form, so that I see only what the current step needs.

#### Acceptance Criteria

1. THE Studio SHALL show a top bar with the product name, one framing line whose first sentence says that punch cards are dead as a computing medium and which says the tool helps designers and card punchers, the loom setup summary, and a menu.
2. THE Studio SHALL show a Step_Rail with Design, Check, Weave and Cards in that order, each with an icon, a label and a one-word or one-number status, and SHALL mark the current Step with `aria-current="step"`.
3. THE Step SHALL be in the URL (`#/design`, `#/check`, `#/weave`, `#/cards`), so Back, Forward and reload return to it; any other hash opens Design.
4. Steps that are not shown SHALL stay mounted and hidden (the `hidden` attribute), so form state, zoom and scroll survive a Step change.
5. Design SHALL hold the gallery, the motif input, the loom setup and the point paper. Check SHALL hold the point paper, the float check, the 2D cloth simulation and the weave per region. Weave SHALL hold the 3D loom. Cards SHALL hold the card chain and the exports. THE point paper SHALL be one instance shared by Design and Check.
6. WHEN the Step changes and reduced motion is not requested, THE change SHALL use a view transition of at most 300 ms that never blocks input; otherwise it SHALL be instant.
7. Every existing action SHALL stay reachable. An action in one Step that targets another ("Go to the float check", "Choose a larger profile", "Open a gallery example") SHALL switch to that Step and move focus as it does today.
8. BELOW 768 px wide, THE Step_Rail SHALL become a bottom bar with 44 px targets, and panels SHALL stack.
9. Alt+1 to Alt+4 SHALL select the Steps in order, and SHALL NOT fire while focus is in a text entry.

### Requirement 3: First minute

**User Story:** As a first-time user, I want to get from an empty screen to a woven preview and a printable card set in under a minute without reading help text.

#### Acceptance Criteria

1. ON an empty grid, THE Design Step SHALL lead with one primary action, opening a gallery example, next to "Describe a motif" and "Upload a sketch".
2. EACH Step except Cards SHALL end with one primary "Continue to <next Step>" button; Cards SHALL lead with "Print cards".
3. FROM the empty Studio, opening an example, continuing to Check, Weave and Cards, and printing SHALL take at most six activations (clicks, taps or key presses on buttons), with no text entry.
4. WHEN the Weave Step opens with a Plan_In_Use and reduced motion is not requested, THE loom SHALL start weaving from pick 0 without a further action.

### Requirement 4: Shared primitives

**User Story:** As a maintainer, I want one set of accessible primitives, so that every dialog, menu, tooltip and toast behaves the same.

#### Acceptance Criteria

1. Dialogs SHALL be built on `@radix-ui/react-dialog`: focus trapped while open, Escape closes, focus returns to the opener or, when the opener is gone or disabled, to the given fallback (the existing Dialog behaviour).
2. Menus SHALL use `@radix-ui/react-dropdown-menu`, tooltips `@radix-ui/react-tooltip`, the loom scrubber `@radix-ui/react-slider`.
3. Toasts SHALL use `sonner` in a polite live region; a sticky message (one the user may act on, such as Undo after a resize) SHALL stay until dismissed; every toast SHALL be dismissible.
4. Icons SHALL come from `lucide-react`; an icon-only control SHALL have an accessible name and a tooltip with the same text.

### Requirement 5: Labels, not paragraphs

**User Story:** As a first-time visitor, I want short labels and help on demand, so that the screen is calm and I can still learn the terms.

#### Acceptance Criteria

1. Every help paragraph that explains a control SHALL become a short label plus a Hint. A Hint opens on hover, on keyboard focus and on tap, and Escape closes it.
2. These notes SHALL stay visible: the untested card format, the WIF `[to verify]` note, the simulation note, the suggestion and stand-in labels, and every empty, loading and error state.
3. Weaving terms (end, pick, float, lift plan, shaft) SHALL keep their tooltips with the wording from `weaving-domain.md`.

### Requirement 6: 3D loom

**User Story:** As a judge, I want to watch the loom weave the design, so that I see punch cards working as a program.

#### Acceptance Criteria

1. THE Weave Step SHALL show a stylised Jacquard loom built with `three`, `@react-three/fiber` and `@react-three/drei`: a walnut frame, a Jacquard head with brass hooks, a card chain on a card cylinder, warp ends from the back beam to the cloth, a shuttle, a reed, and the cloth at the front.
2. THE hooks SHALL be laid out like the card: one hook per card position in rows of `hooksPerCardRow`. Spare hooks SHALL be shown and SHALL never rise.
3. AT every Loom_Time, THE raised hooks and warp ends SHALL be exactly the current card's lifted hooks (Requirement 9), and the cloth SHALL show exactly the woven picks of the Loom_Frame.
4. THE card chain SHALL show the current card on the cylinder with its punched holes and the neighbouring cards in lacing order, wrapping from the last card to card 1 (engine `nextCard`).
5. THE Weave Step SHALL say, in one line, that it is a stylised loom and that the card format has not been tested on a working loom.
6. IF WebGL is not available or the scene fails, THEN THE Weave Step SHALL say so in one line and keep the transport, the readout and the current card working.
7. THE three.js code SHALL load only when the Weave Step is first opened (or when the pointer rests on its rail item), as its own chunk.
8. WHILE the Weave Step is hidden, paused or the tab is in the background, THE scene SHALL not render frames continuously.

### Requirement 7: Transport

**User Story:** As a designer, I want to play, pause and scrub the weaving, so that I can study any pick.

#### Acceptance Criteria

1. THE Weave Step SHALL offer Play/Pause, a scrubber over the picks, step back and step forward by one pick, and speeds 0.5x, 1x, 2x and 4x, all keyboard operable.
2. THE Weave Step SHALL show, in sync with the scene, the card number in lacing order (card `n` weaves pick `n - 1`), the pick, the number of lifted hooks, and the current card drawn flat with its holes, highlighted in a strip of neighbouring cards. The readout SHALL be a polite live region updated at most once per pick, and only while paused or stepping.
3. THE loom SHALL use the Plan_In_Use and say which plan it uses (fixed or design). WHEN the plan changes, THE loom SHALL go back to pick 0.
4. WHILE the float check reports violations and no fixed plan is current, THE Weave Step SHALL show the violation count with a link to Check, and SHALL still weave.
5. WHEN reduced motion is requested, THE loom SHALL not start by itself, and stepping SHALL jump to the end state of a pick.
6. WHEN there is no Plan_In_Use, THE Weave Step SHALL show the simulator's empty states (blank grid, or an engine error with "Go to the float check").

### Requirement 8: Loom sound

**User Story:** As a judge watching the demo, I want the loom to sound like a machine.

#### Acceptance Criteria

1. THE loom SHALL make procedural sounds with `tone` (no audio files): a card clack on advance, a metallic tick on lift, a soft whoosh for the shuttle and a low thud on the beat.
2. Sound SHALL be off on every visit and SHALL start only after the user turns it on; `tone` SHALL load only then.
3. THE sound control SHALL be a labelled toggle with `aria-pressed`.
4. Sound SHALL follow play, pause and speed, SHALL play at most one sound of each kind per pick, and SHALL stop when the Weave Step is hidden.

### Requirement 9: Loom model

**User Story:** As a maintainer, I want the loom animation to come from the engine's cards, so that the 3D view never shows a lift the cards do not make.

#### Acceptance Criteria

1. `buildLoomModel(plan, profile, yarns)` SHALL return the card set from the engine's `buildCards`, for each card its lifted figuring hooks read back through the engine's `decodeCards`, and the face cloth from `clothModel`; any engine or export error SHALL be returned unchanged.
2. `loomFrame(model, t)` SHALL clamp `t` to `[0, pickCount]` and return the current pick `min(floor(t), pickCount - 1)`, the card number `pick + 1`, and the Phase.
3. THE height of position `p` in a Loom_Frame SHALL be 0 when `p` is not lifted by the current card, and 1 for every lifted position throughout the shuttle Phase; spare positions SHALL always be 0. So the raised set during the shuttle equals the current card's lifted set: `punched[h]` when `holeMeans` is `lift`, `!punched[h]` when it is `noLift`, which equals `plan.lifts[pick][h]`.
4. THE number of woven picks SHALL be `pick` before the end of the beat Phase of `pick`, `pick + 1` from then on, and `pickCount` at `t = pickCount`; it SHALL never decrease as `t` grows.
5. THE cloth texture for a Loom_Frame SHALL hold, for every woven pick, `clothModel`'s colour for every hook, and SHALL be transparent for picks not yet woven.
6. THE card strip for a pick SHALL list neighbouring card indices in lacing order with the engine's `nextCard`, wrapping round.
7. These functions SHALL be pure and deterministic and SHALL contain no weaving rule: lifts come from the engine's cards and colours from `clothModel`.

### Requirement 10: Opening

**User Story:** As a judge opening the link for the first time, I want a short, memorable entrance that sets the story in one line.

#### Acceptance Criteria

1. ON the first visit, THE app SHALL show the Opening over the Studio: the loom room in the dark, the line "In 1804, punch cards were the first programs. Handlooms still run on them.", then the lights come up into the Studio. It SHALL take under 4 seconds in total.
2. THE Opening SHALL be skippable at any time with a visible "Skip" button, Escape, Enter or a click, and focus SHALL then go to the Studio's first heading or control.
3. THE Opening SHALL be shown once per browser (`localStorage`), and never when the URL names a Step other than Design.
4. WHEN reduced motion is requested, THE Opening SHALL show the line without movement or fades and leave after the same time or on skip.
5. THE Opening SHALL not delay loading or using the Studio underneath: the Studio renders at the same time, and the Opening holds no data.

### Requirement 11: Purposeful motion

**User Story:** As a designer, I want the important events to be visible, so that I see what changed and why.

#### Acceptance Criteria

1. WHEN a motif or a gallery example replaces the grid, THE point paper SHALL reveal it cell by cell in weaving order (pick 0 upward) over at most 900 ms, every cell placed exactly once; any edit or Step change SHALL finish the reveal at once.
2. WHILE the point paper shows float violations, THE violation marks SHALL pulse gently, keeping their outline and triangle, so colour and shape still mark them.
3. WHEN auto-fix succeeds, THE point paper SHALL show the auto-fix changes and place the engine's flips one by one in the engine's order over at most 1.5 s, each flip once, ending with all shown.
4. WHEN the Cards Step shows a card large for the first time, THE card SHALL punch its holes row by row over at most 800 ms.
5. WHEN reduced motion is requested, every Moment SHALL show its end state at once.
6. Motion SHALL use the `motion` library for component animation and `requestAnimationFrame` for canvas animation, and SHALL never block input. No other decorative animation SHALL be added.

### Requirement 12: Cards Step

**User Story:** As a card puncher, I want to see the cards as cards and print them.

#### Acceptance Criteria

1. THE Cards Step SHALL draw the card set from the engine's `buildCards` and `cardRows`: card-stock surface, punched holes that show the background through, lacing holes at both ends, and the card number at the numbered end.
2. THE cards SHALL appear as a chain in lacing order; the user SHALL select a card by click, tap or arrow keys and see it large with its number and punched count.
3. A print stylesheet SHALL print every card, numbered, in lacing order, with the untested-format note and no Studio chrome, from the "Print cards" button and from the browser's print command.
4. THE export panel SHALL stay in the Cards Step with its gate, notes and states unchanged.

### Requirement 13: Accessibility

**User Story:** As a keyboard or screen reader user, I want the new studio to work at least as well as the old form.

#### Acceptance Criteria

1. Every control SHALL keep a visible label or an accessible name, a keyboard path and a visible focus ring.
2. Float violations SHALL keep colour plus shape (outline and triangle) on the point paper and a text list in the float check.
3. THE 3D loom SHALL have a text equivalent: the readout (card, pick, lifted hooks) and the flat current card.
4. `prefers-reduced-motion: reduce` SHALL turn off view transitions, pulses, reveals, the Opening's movement and autoplay.
5. Hit targets SHALL be at least 44 px on touch.

### Requirement 14: Performance

**User Story:** As a judge on a mid-range laptop, I want the first screen fast.

#### Acceptance Criteria

1. `three`, `@react-three/fiber`, `@react-three/drei` and `tone` SHALL NOT be in the entry chunk.
2. Lighthouse on the production build (`vite build`, `vite preview`) SHALL score at least 90 for Performance, Accessibility and Best Practices.
3. THE 3D loom SHALL use instancing for hooks and cards, cap the pixel ratio at 2, and render on demand while paused.

### Requirement 15: Boundaries and dependencies

#### Acceptance Criteria

1. Files under `packages/engine`, `packages/export`, `packages/motif`, `packages/mcp` and `backend` SHALL NOT change.
2. Every new dependency SHALL be pinned to an exact version published at least 14 days before it was added (on or before 2026-11-09).
3. All existing tests SHALL keep passing. Tests that render the whole App MAY add steps that open a Step before they act, and MAY query hidden panels for document order; no assertion about behaviour or copy SHALL be removed or loosened.
4. No weaving rule SHALL be written in `apps/web`.

### Requirement 16: Verification

#### Acceptance Criteria

1. Each wave that changes the UI SHALL be checked through the Chrome DevTools MCP server at 1440x900 and 390x844; the final screenshots SHALL be saved under `media/polish/`.
2. THE `design-reviewer` agent SHALL review the UI after each wave, and its findings SHALL be fixed or answered in the journal.

## Labels

Same labels as the weave-engine spec. No new loom fact. The 3D loom is stylised; its hook layout follows the profile's card layout (`cardRows`), whose row placement stays `[to verify]`.

## Decision log

Gap analysis run by the agent under `.kiro/steering/autopilot.md`, using `PLAN.md`, the steering files and the code as the source of truth.

| Q | Answer | Label |
|---|---|---|
| Scope change | The first brief (scroll story, second theme, guided tour, command palette, new cloth renderer) was replaced by the user mid-wave-1. Wave 0 had already added gsap, @gsap/react, lenis, driver.js, cmdk, @radix-ui/react-popover, a Theme store and a Story stub; all are removed. The spec was rewritten to the second brief. | [decision] |
| `design-language.md` says motion under 200 ms, one sans-serif, Halloween nod only in the gallery | Updated to the brief: interface transitions up to 300 ms, Moments up to 1.5 s that explain an event and never block input, a display serif for headings, one theme, the Opening as the only Kiroween nod. | [decision] |
| Command palette | Not built. With four Steps, a rail and a "Continue" button per Step the palette adds a second way to do everything, which the guidance ("simple, focused") argues against. cmdk is not a dependency. | [decision] |
| The Opening's line does not contain "dead as a computing medium" (`product.md` and `PLAN.md`: say it in the first line) | The Opening shows the user's line exactly. The Studio's top bar, the first text that stays on screen, still opens with "Punch cards are dead as a computing medium.", and the existing test for it stays. Listed for the user in the status. | [decision] |
| Existing App tests expect every panel on one page | Tests that render the whole App get an `openStep` helper (15.3); the document-order test queries hidden panels. Panel component tests do not change. Each changed test is listed in the journal. | [decision] |
| Hidden Steps mounted or unmounted | Mounted with `hidden` (2.4). The three.js chunk mounts on the first Weave visit and stays. | [decision] |
| Step in the URL without hashchange timing | The Studio keeps the Step in React state and records it with `history.pushState`; `popstate` reads it back. Tests reset the URL in `installDom`. | [decision] |
| Radix Dialog and the native `<dialog>` contract (tests query `dialog[open]`) | The Dialog keeps its props and renders Radix `Dialog.Content` as a `<dialog open>` element (`asChild`). Focus returns synchronously when `open` turns false, as today; Radix's own return is prevented. | [decision] |
| Tooltips on touch (Radix Tooltip ignores touch) | `Hint` is a Radix Tooltip whose trigger also toggles it on click or tap, so one primitive covers hover, focus and tap. `Term` keeps its tested behaviour and is restyled. | [decision] |
| Dark theme | None (user). The Opening's dark room is a moment, not a theme. | [decision] |
| Autoplay in Weave | On by default when motion is allowed (3.4), so the first-minute flow needs no extra click. Off with reduced motion (7.5). | [decision] |
| `@react-three/postprocessing` | Not used; emissive brass and a warm light instead, for chunk size (14.1). | [decision] |
| Fonts | Fraunces (variable, display serif), Instrument Sans (variable, interface), IBM Plex Mono 400 and 500 (numbers), from Fontsource. | [decision] |
| Versions (15.2, cutoff 2026-11-09) | three 0.187.0, @types/three 0.187.0, @react-three/fiber 9.8.2, @react-three/drei 10.7.9, motion 14.11.1 (14.14.0 is from 2026-11-13), tone 15.1.22, sonner 2.0.8, lucide-react 1.70.0 (1.78.0 is from 2026-11-23), tailwindcss and @tailwindcss/vite 4.3.5, @radix-ui/react-dialog 1.3.1, -dropdown-menu 2.2.1, -slider 1.6.1, -tooltip 1.4.1, Fontsource packages 5.3.0. Dates read with `npm view <name> time` on 2026-11-23. | [decision] |
| Phase timing inside one pick | advance 0 to 0.2, lift 0.2 to 0.35, shuttle 0.35 to 0.7, beat 0.7 to 0.85, settle 0.85 to 1. Woven picks increase at 0.85. | [decision] |
| Hook heights outside the shuttle Phase | Rise with an ease over lift, 1 over shuttle and beat, fall over settle, 0 over advance. Only lifted positions move (9.3). | [decision] |
| Which side the 3D cloth shows | The face, from `clothModel(..., "face")`, which already follows `wovenFaceDown`. | [decision] |
| Spare and idle hooks | Spare hooks are dimmed and never rise (the engine never lifts them). Idle hooks follow the plan. | [decision] |
| Plan with violations in Weave | It weaves (the cloth shows the long floats) with a status line linking to Check (7.4). | [decision] |
| Speed | 1x is 2 picks per second. | [decision] |
| Sound persistence | Not kept; off on every visit (8.2). | [decision] |
| Opening timing | 0 to 0.4 s dark room; 0.4 to 2.6 s the line; 2.6 to 3.6 s lights up and the overlay fades; gone at 3.6 s. Key `jacquard.openingSeen`. | [decision] |
| Reveal order | Pick 0 upward, end 0 rightward within a pick, batched by frame so a 400-pick grid still finishes inside 900 ms. | [decision] |
| Auto-fix placement order | The engine's `flips` order, unchanged. | [decision] |
| Card chain size | The chain shows up to 24 cards around the selected one; printing draws every card. | [decision] |
| Print | `@media print` hides the Studio and shows a print-only sheet of every card, rendered on `beforeprint` and by "Print cards". The PDF export stays the precise output. | [decision] |
| Screenshots in git | Committed only if `media/polish/` stays under 8 MB; otherwise ignored, and the journal says so. | [decision] |
| Where the "Continue" action sits (3.2) | In the Step rail, at the right on wide screens and above the four Steps in the bottom bar on phones, so the one primary action is always in the same place and at the thumb. Not at the end of each Step's content. (design-reviewer, wave 1) | [decision] |
| The motif panel's empty state repeats the point paper's start actions | Kept: the motif panel is tested on its own with those actions (`motif-panel.test.tsx`). In the Studio its gallery action is secondary, so the Step still has one primary start action, on the point paper. (design-reviewer, wave 1, finding 15) | [decision] |
| Tooltip providers inside `Hint` and `IconButton` | Kept: panels using them are rendered without the Studio in their own tests, and Radix Tooltip throws without a provider. The cost is losing the skip-delay between neighbouring tips. (design-reviewer, wave 1, finding 21) | [decision] |
| Fix report repeats the counts and keeps "It is kept until you edit the design…" | Kept: `float-panel.test.tsx` asserts both. (design-reviewer, wave 1, finding 28) | [decision] |

