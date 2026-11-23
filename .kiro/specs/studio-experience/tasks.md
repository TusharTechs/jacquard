# Implementation Plan: studio-experience

## Overview

One clear flow and one showpiece: tokens and look, the Step shell with labels instead of paragraphs, the 3D loom driven by the engine's cards, a one-screen Opening, purposeful Moments, and realistic cards with a print stylesheet. Follows `requirements.md` and `design.md` (rewritten after the user's second brief; see the Decision log).

All 7 correctness properties have their own property test task. Every property test task is required. There are no optional tasks.

## Task rules

- **Finish.** `pnpm typecheck` and `pnpm test`, each with its own exit code read from pnpm (not from a pipe), both `EXIT_CODE=0`, every vitest summary line with a non-zero passed count and no failures.
- **Property tests.** fast-check with `{ seed, numRuns: 100 }` constants, tag `Feature: studio-experience, Property N: <title>`, files ending `.property.test.ts`.
- **Failures.** Report every property failure in full (property, shrunk counterexample verbatim, seed, requirement) before fixing it. Never weaken a test.
- **Boundaries.** No file under `packages/` or `backend/` changes. New dependencies pinned exactly, published on or before 2026-11-09.
- **Visual.** UI waves end with Chrome DevTools MCP screenshots at 1440x900 and 390x844 and a `design-reviewer` run.
- **No journal, no git inside tasks.**

## Tasks

- [x] 1. Foundations
  - [x] 1.1 Pinned dependencies; Tailwind v4 through `@tailwindcss/vite`; Fontsource; tokens in `styles.css`; `design-language.md` updated
    - _Requirements: 1.1 to 1.4, 15.2_
  - [x] 1.2 `lib/route.ts`, `lib/reduced-motion.ts`, `lib/view-transition.ts`; remove what the second brief dropped (theme store, Story stub, gsap, lenis, driver.js, cmdk, popover)
    - _Requirements: 2.3, 2.6, 13.4_
  - [x] 1.3 Write property test: **Property 7: Step route round trip** — **Validates: Requirements 2.3**
- [x] 2. Studio shell
  - [x] 2.1 Primitives: Radix `ui/dialog.tsx` (same props), `ui/hint.tsx`, `ui/icon-button.tsx`, `ui/toaster.tsx` (sonner), `shell/studio-menu.tsx`
    - _Requirements: 4.1 to 4.4, 5.1_
  - [x] 2.2 `shell/top-bar.tsx`, `shell/step-rail.tsx`; `app.tsx` in Steps with the shared workbench; Continue buttons; cross-Step focus; Alt+1..4; view transitions; mobile bottom rail
    - _Requirements: 2.1 to 2.9, 3.1, 3.2, 13.1, 13.5_
  - [x] 2.3 Labels, not paragraphs: Hints in every panel; required notes kept
    - _Requirements: 5.1 to 5.3_
  - [x] 2.4 Tests: `openStep` in the App-level tests; rail, Hint, toaster, Continue and cross-Step focus tests
    - _Requirements: 2.2 to 2.9, 4.1, 4.3, 5.1, 15.3_
- [ ] 3. Weave Step
  - [ ] 3.1 `lib/loom-model.ts` and `lib/loom-transport.ts`
    - _Requirements: 9.1 to 9.7, 7.1, 7.5_
  - [ ] 3.2 Write property test: **Property 1: The loom lifts exactly the hooks the current card punches** — **Validates: Requirements 9.1, 9.3, 6.2, 6.3**
  - [ ] 3.3 Write property test: **Property 2: Cloth growth matches the lift plan pick for pick** — **Validates: Requirements 9.4, 9.5, 6.3**
  - [ ] 3.4 Write property test: **Property 3: Loom time maps to card and phase** — **Validates: Requirements 9.2, 7.2**
  - [ ] 3.5 Write property test: **Property 4: The card strip follows the lacing chain** — **Validates: Requirements 9.6, 6.4, 12.2**
  - [ ] 3.6 `cards/card-face.tsx`, `weave/weave-step.tsx` (transport, readout, strip, states, fallback clock, autoplay) and the lazy `weave/loom-scene.tsx`
    - _Requirements: 3.4, 6.1 to 6.8, 7.1 to 7.6, 13.3, 14.3_
  - [ ] 3.7 `lib/loom-sound.ts` and the sound toggle
    - _Requirements: 8.1 to 8.4_
  - [ ] 3.8 Tests for the Weave Step without WebGL and the sound toggle
    - _Requirements: 3.4, 6.6, 7.1 to 7.6, 8.2, 8.3_
- [ ] 4. Opening, Moments and Cards
  - [ ] 4.1 `opening.tsx` and its tests
    - _Requirements: 10.1 to 10.5, 13.4_
  - [ ] 4.2 `lib/reveal.ts`, `lib/flip-sequence.ts`, the marks overlay and pulse in `point-paper.tsx`
    - _Requirements: 11.1 to 11.3, 11.5, 11.6, 13.2_
  - [ ] 4.3 Write property test: **Property 5: The motif reveal places every cell once** — **Validates: Requirements 11.1, 11.5**
  - [ ] 4.4 Write property test: **Property 6: Auto-fix placement shows the engine's flips in order** — **Validates: Requirements 11.3**
  - [ ] 4.5 `cards/card-chain.tsx`, `cards/print-sheet.tsx`, `cards/cards-step.tsx`, print stylesheet, punching Moment, and their tests; the first-minute path test
    - _Requirements: 3.2, 3.3, 11.4, 12.1 to 12.4_
- [ ] 5. Performance and verification
  - [ ] 5.1 Build test for the entry chunk; Lighthouse on `vite preview`, fix to at least 90
    - _Requirements: 14.1 to 14.3_
  - [ ] 5.2 Final screenshots to `media/polish/` (each Step and the Opening, 1440x900 and 390x844); `git diff --stat phase-H -- packages backend` is empty
    - _Requirements: 15.1, 16.1_

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["2.1", "2.2", "2.3", "2.4"] },
    { "id": 2, "tasks": ["3.1", "3.2", "3.3", "3.4", "3.5", "3.6", "3.7", "3.8"] },
    { "id": 3, "tasks": ["4.1", "4.2", "4.3", "4.4", "4.5"] },
    { "id": 4, "tasks": ["5.1", "5.2"] }
  ]
}
```

## Notes

- Property-to-task mapping: P1 3.2, P2 3.3, P3 3.4, P4 3.5, P5 4.3, P6 4.4, P7 1.3.
- Wave 0 ran under the first brief and was redone in place under the second (task 1.2); its commit is `279f8a0`.
