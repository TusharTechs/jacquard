# Implementation Plan: studio-experience

## Overview

Turn `apps/web` into the loom-room studio: tokens and themes, the Step shell, the command palette and primitives, the 3D loom driven by the engine's cards, the opening Story, the Moments, the thread-level cloth and the Cards Step. Follows `requirements.md` and `design.md`.

All 9 correctness properties have their own property test task. Every property test task is required. There are no optional tasks.

## Task rules

- **Finish.** `pnpm typecheck; echo "EXIT_CODE=$?"` and `pnpm test; echo "EXIT_CODE=$?"` both `EXIT_CODE=0`, every vitest summary line with a non-zero passed count and no failures.
- **Property tests.** fast-check with `{ seed, numRuns: 100 }` constants, tag `Feature: studio-experience, Property N: <title>`, files ending `.property.test.ts`.
- **Failures.** Report every property failure in full (property, shrunk counterexample verbatim, seed, requirement) before fixing it. Never weaken a test.
- **Boundaries.** No file under `packages/` or `backend/` changes. New dependencies pinned exactly, published on or before 2026-11-09.
- **Visual.** UI waves end with Chrome DevTools MCP screenshots at 1440x900 and 390x844 in both Themes and a `design-reviewer` run.
- **No journal, no git inside tasks.**

## Tasks

- [ ] 1. Foundations
  - [ ] 1.1 Add the pinned dependencies to `apps/web`; Tailwind v4 through `@tailwindcss/vite`; Fontsource imports; tokens and both Themes in `styles.css`; theme bootstrap in `index.html`; update `.kiro/steering/design-language.md` (Decision log, row 1)
    - _Requirements: 1.1 to 1.6, 16.2_
  - [ ] 1.2 `lib/route.ts`, `lib/theme.ts`, `lib/reduced-motion.ts`, `lib/view-transition.ts`, `root.tsx`, `main.tsx`
    - _Requirements: 1.4, 2.3, 2.6, 10.5_
  - [ ] 1.3 Write property test: **Property 8: Theme resolution** — **Validates: Requirements 1.4**
  - [ ] 1.4 Write property test: **Property 9: Route round trip** — **Validates: Requirements 2.3, 10.5**
- [ ] 2. Studio shell
  - [ ] 2.1 Primitives: Radix `ui/dialog.tsx` (same props), `ui/icon-button.tsx`, `ui/info-tip.tsx`, `ui/toaster.tsx` (sonner), menus
    - _Requirements: 4.1 to 4.4_
  - [ ] 2.2 `shell/top-bar.tsx`, `shell/step-rail.tsx`, `shell/studio-menu.tsx`; restructure `app.tsx` into Steps with the shared workbench; cross-Step focus actions; Alt+1..4; view transitions; mobile bottom rail
    - _Requirements: 2.1 to 2.9, 14.1, 14.5_
  - [ ] 2.3 `shell/command-palette.tsx` and the command list in `app.tsx`; export requests through the panel's gate
    - _Requirements: 3.1 to 3.5_
  - [ ] 2.4 Less text: info tips in the panels; `lib/tour.ts` with driver.js and the first-visit offer
    - _Requirements: 5.1 to 5.4_
  - [ ] 2.5 Tests: `openStep` helper in the App-level tests; new tests for the rail, palette, theme toggle and tour offer
    - _Requirements: 2.2 to 2.9, 3.1 to 3.5, 5.4, 16.3_
- [ ] 3. Loom model and Weave Step
  - [ ] 3.1 `lib/loom-model.ts` and `lib/loom-transport.ts`
    - _Requirements: 9.1 to 9.7, 7.1, 7.5_
  - [ ] 3.2 Write property test: **Property 1: The loom lifts exactly the hooks the current card punches** — **Validates: Requirements 9.1, 9.3, 6.2, 6.3**
  - [ ] 3.3 Write property test: **Property 2: Cloth growth matches the lift plan pick for pick** — **Validates: Requirements 9.4, 9.5, 6.3**
  - [ ] 3.4 Write property test: **Property 3: Loom time maps to card and phase** — **Validates: Requirements 9.2, 7.2**
  - [ ] 3.5 Write property test: **Property 4: The card strip follows the lacing chain** — **Validates: Requirements 9.6, 6.4, 13.2**
  - [ ] 3.6 `weave/weave-step.tsx` (transport, readout, card strip, states, fallback clock) and the lazy `weave/loom-scene.tsx`
    - _Requirements: 6.1 to 6.8, 7.1 to 7.6, 14.3, 15.3_
  - [ ] 3.7 `lib/loom-sound.ts` (lazy tone) and the sound toggle
    - _Requirements: 8.1 to 8.4_
  - [ ] 3.8 Tests for the Weave Step without WebGL
    - _Requirements: 6.6, 7.1 to 7.6, 8.2, 8.3_
- [ ] 4. Story
  - [ ] 4.1 `story/story.tsx`, `story/story-loom.tsx`, lazy `story/story-motion.ts` (gsap, ScrollTrigger, lenis)
    - _Requirements: 10.1 to 10.5, 14.3, 14.4_
  - [ ] 4.2 Story tests (first line, skip link first, beats as headings, framing scans, no motion import with reduced motion)
    - _Requirements: 10.2 to 10.4_
- [ ] 5. Moments, cloth and cards
  - [ ] 5.1 `lib/reveal.ts`, `lib/flip-sequence.ts`, the marks overlay and pulse in `point-paper.tsx`
    - _Requirements: 11.1 to 11.3, 11.5, 11.6, 14.2_
  - [ ] 5.2 Write property test: **Property 5: The motif reveal places every cell once** — **Validates: Requirements 11.1, 11.5**
  - [ ] 5.3 Write property test: **Property 6: Auto-fix placement shows the engine's flips in order** — **Validates: Requirements 11.3**
  - [ ] 5.4 `lib/draw-threads.ts`, `SimulatorPanel` thread zoom, `initialZoom`, the flip
    - _Requirements: 12.1 to 12.4_
  - [ ] 5.5 Write property test: **Property 7: The thread renderer draws each cell's top thread in its clothModel colour** — **Validates: Requirements 12.1, 12.2**
  - [ ] 5.6 `cards/card-face.tsx`, `cards/card-chain.tsx`, `cards/print-sheet.tsx`, `lib/card-chain.ts`, `cards/cards-step.tsx`; print stylesheet; punching Moment
    - _Requirements: 13.1 to 13.4, 11.4_
  - [ ] 5.7 Tests for the Cards Step and print sheet
    - _Requirements: 13.1 to 13.3_
- [ ] 6. Performance and verification
  - [ ] 6.1 Build test for chunk contents; Lighthouse on `vite preview` (Story and Studio), fix to at least 90
    - _Requirements: 15.1 to 15.3_
  - [ ] 6.2 Final screenshots to `media/polish/` (each Step and the Story, 1440x900 and 390x844, both Themes); `git diff --stat phase-H -- packages backend` is empty
    - _Requirements: 16.1, 17.1_

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3", "1.4"] },
    { "id": 1, "tasks": ["2.1", "2.2", "2.3", "2.4", "2.5"] },
    { "id": 2, "tasks": ["3.1", "3.2", "3.3", "3.4", "3.5", "3.6", "3.7", "3.8"] },
    { "id": 3, "tasks": ["4.1", "4.2"] },
    { "id": 4, "tasks": ["5.1", "5.2", "5.3", "5.4", "5.5", "5.6", "5.7"] },
    { "id": 5, "tasks": ["6.1", "6.2"] }
  ]
}
```

## Notes

- Property-to-task mapping: P1 3.2, P2 3.3, P3 3.4, P4 3.5, P5 5.2, P6 5.3, P7 5.5, P8 1.3, P9 1.4.
