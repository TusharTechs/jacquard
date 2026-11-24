# Implementation Plan: demo-video

All 3 correctness properties have their own property test task. Every property test task is required.

## Tasks

- [x] 1. Package and data
  - [x] 1.1 `video/` package (pinned deps, workspace, tsconfig, vitest), `theme.ts` with a test against `styles.css`
    - _Requirements: 1.1 to 1.3, 6.1_
  - [x] 1.2 `script.ts`, `cues.ts`, `mix.ts`; `scripts/make-script-md.ts`, `scripts/make-srt.ts`
    - _Requirements: 2.1 to 2.7, 5.3_
  - [x] 1.3 Write property test: **Property 1: Caption cues keep the narration** — **Validates: Requirements 2.6**
  - [x] 1.4 Write property test: **Property 2: SRT round trip** — **Validates: Requirements 2.6**
  - [x] 1.5 Write property test: **Property 3: Music stays 18 dB under the voice** — **Validates: Requirements 5.3**
- [x] 2. Footage and sound
  - [x] 2.1 `apps/web/src/lib/loom-sound-patches.ts` (pure move, app tests unchanged); `video/audio/` score and effects rendered offline; loudness check
    - _Requirements: 5.1 to 5.3_
  - [x] 2.2 Capture: `capture/*.spec.ts`, screencast, audio tap, assemble
    - _Requirements: 3.1 to 3.4_
  - [x] 2.3 Copy Allowed_Footage, check every frame used, `privacy-log.md`
    - _Requirements: 4.1, 4.2_
- [x] 3. Script and storyboard
  - [x] 3.1 Remotion scenes and compositions
    - _Requirements: 2.1, 2.4, 2.5, 6.1, 6.2_
  - [x] 3.2 Script and storyboard: `script.md`, storyboard stills, low-resolution draft render; then the Review_Stop
    - _Requirements: 7.1_
- [ ] 4. Final (after Tushar's review)
  - [ ] 4.1 Final Main_Cut, `.srt`, Vertical_Cut
    - _Requirements: 2.6, 7.2_
  - [ ] 4.2 Journal with "Surprise", commit, push, tag `phase-video`
    - _Requirements: 7.2_

## Task Dependency Graph

```json
{ "waves": [ { "id": 0, "tasks": ["1.1", "1.2", "1.3", "1.4", "1.5"] }, { "id": 1, "tasks": ["2.1", "2.2", "2.3"] }, { "id": 2, "tasks": ["3.1", "3.2"] }, { "id": 3, "tasks": ["4.1", "4.2"] } ] }
```
