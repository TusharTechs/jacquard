# Requirements Document

## Introduction

Scope: a demo video for the Kiroween judges, under 2:50, that wins on Presentation. The judges asked for "a strong demo video that articulates the problem, and a functioning solution", "how you used specs, steering and hooks", and "bonus points if Kiro surprised you". Devpost's tips: tell a story, use a voiceover, complement the write-up rather than repeat it.

Code location: `video/`, a new workspace package `@jacquard/video` (Remotion compositions, Playwright capture, audio synthesis, script data, tests). No other package changes, except one pure-data module extracted from `apps/web` so that the video's sound effects reuse the app's tone patches (see the Decision log). Acceptance criteria are cited as `N.M`.

## Glossary

- **Live_URL**: `https://main.d28e9v65r7sow0.amplifyapp.com`.
- **Main_Cut**: the 1920x1080, 30 fps, H.264 mp4, under 2:50.
- **Vertical_Cut**: the 1080x1920 cut of 45 seconds or less, for social posts.
- **Script_Data**: `video/src/script.ts`, the one source for the narration, scene timings and captions.
- **Capture**: the Playwright recording of the Live_URL.
- **Allowed_Footage**: `media/journey/2026-11-16-clip-*.mp4` except `clip-browser-*`; the PNG stills in `media/journey`, `media/polish`, `media/deploy` and `media/motif-builder`; the Capture; Remotion renders of repo files. Never `media/journey/autopilot/` or the other long recordings.
- **Review_Stop**: the point after task "script and storyboard" where work stops for Tushar's review.

## Requirements

### Requirement 1: Package and tooling

1. `video/` SHALL be a pnpm workspace package `@jacquard/video` with exact dependency versions, each published at least 14 days before 2026-11-24 (Remotion 4.0.542, Playwright 1.65.0; React, Tone and Fontsource at the web app's versions).
2. Rendered video, captured footage, generated audio and copied media SHALL be gitignored; only source is committed.
3. `pnpm typecheck` and `pnpm test` SHALL include the package and pass.

### Requirement 2: Story and script

1. THE video SHALL have four scenes in this order: Problem (about 0:00–0:20), Working solution (about 0:20–1:25), How Kiro built it (about 1:25–2:30), Honest close (about 2:30–2:50); the Main_Cut SHALL be under 2:50.
2. Script_Data SHALL hold the narration per scene; `video/script.md` SHALL be generated from it with narration, word count and timing per scene at about 140 words a minute (Property 1).
3. Problem claims SHALL be only what `product.md` and `weaving-domain.md` allow, with their labels recorded in Script_Data; no invented statistics. Numbers about the build SHALL come only from the running tally of `KIRO_JOURNEY.md`.
4. "How Kiro built it" SHALL cover specs (requirements to properties to tasks), steering, hooks, custom agents, MCP (jacquard-weave, Chrome DevTools, AWS Documentation), property-based tests, the Power, the local Kiro CLI run (saying that API keys need a paid plan), and the Amplify deploy driven by Kiro, built around 3 or 4 "Surprise" moments from `KIRO_JOURNEY.md`.
5. THE close SHALL say the card format has not been tested on a working loom, that the motif step is a builder, not AI, and show the Live_URL, the repo and "Built with Kiro".
6. Captions SHALL be burned in from the same text as the narration, and an `.srt` SHALL be generated from it (Property 2).
7. Until Tushar's recording exists, the narration track SHALL be silent and captions shown. No text-to-speech in any render.

### Requirement 3: Capture of the live site

1. THE Capture SHALL record the Live_URL with Playwright in headed Chromium (so WebGL renders), with the app's sound on, at 1920x1080, from `video/capture/*.spec.ts`, and be repeatable.
2. It SHALL show, in order: the Opening line; typing "a peacock in gold and maroon on a cream ground" and the motif builder drawing it with its chips; the float violations pulsing; auto-fix placing its flips; the 3D loom weaving with tone sound; the Cloth view easing in on the repeated peacocks; the card chain punching; Print and the WIF export.
3. THE Capture SHALL record the app's own audio output in sync with the picture.
4. No old `clip-browser-*` footage SHALL be used.

### Requirement 4: Privacy of footage

1. EVERY frame of Allowed_Footage used SHALL be checked for email addresses, AWS account ids, ARNs, names of other projects, browser profiles, Slack or mail; anything found is cropped or the footage dropped.
2. `video/privacy-log.md` SHALL list every asset used, the time range, what was checked, and any crop or drop.

### Requirement 5: Sound

1. All sound SHALL be original: a short score and the sound effects composed in code under `video/audio/`, rendered offline; no samples or music from elsewhere.
2. Card punch, loom and shuttle sounds SHALL reuse the app's tone patches.
3. Music under narration SHALL be at least 18 dB below the voice (Property 3).

### Requirement 6: Look

1. THE video SHALL use the app's design language: card stock, walnut, brass, Fraunces, Instrument Sans, IBM Plex Mono; real UI; motion only when it explains something.
2. No logos or trademarks other than the Kiro name in text.

### Requirement 7: Deliverables and the review stop

1. BEFORE the Review_Stop: `video/script.md`, one storyboard still per scene (`video/out/storyboard/*.png`) and a low-resolution draft render. Then work stops until Tushar has reviewed them.
2. AFTER the review: the final Main_Cut, the `.srt`, the Vertical_Cut, a journal entry with a "Surprise" heading, commit (source only), push, tag `phase-video`.

## Decision log

| Q | Answer | Label |
|---|---|---|
| How is the app's sound captured? | Playwright's video has no audio. An init script taps the page's Web Audio output (every connection to an `AudioDestinationNode` also feeds a `MediaStreamAudioDestinationNode` recorded by `MediaRecorder`) and saves it with its start time, so the app's real tone sounds line up with the picture (3.3). | [decision] |
| Which video recorder? | The Chrome DevTools Protocol screencast (`Page.startScreencast`, JPEG quality 92, timestamped frames), assembled by ffmpeg into constant 30 fps H.264. Playwright's `recordVideo` encodes at a low fixed bitrate that blurs text at 1080p. | [decision] |
| Reusing the app's tone patches | The synth settings in `apps/web/src/lib/loom-sound.ts` move unchanged into a pure-data module `apps/web/src/lib/loom-sound-patches.ts`, imported by both the app and `video/audio/`. Behaviour of the app does not change. | [decision] |
| How is the score rendered offline? | Tone.js 15.1.22 (the app's version) in `Tone.Offline`, run in headless Chromium through Playwright, written to WAV. | [decision] |
| "a long float is a mistake you only find on the loom" | Neither `product.md` nor `weaving-domain.md` says when a float is found. `weaving-domain.md` says long floats snag and weaken cloth; the narration uses that and says JACQUARD checks every float before a card is punched. Flagged for review. | [decision] |
| "cards are punched by hand" | `product.md` names card punchers (card cutters) who turn a design into a physical card set; the narration says that and no more. Flagged for review. | [decision] |
| Problem visuals | Point paper and a punched card drawn from the real engine and export output (`@jacquard/export` `pointPaperSvg` and `cardSheetSvg`) for a gallery design, not invented graphics. | [decision] |
| Music level | The voice is mixed to about −16 LUFS; the score under narration is at most −34 LUFS (18 dB lower), checked with ffmpeg's EBU R128 meter on the rendered music stem. Until the voice exists, the check uses the −16 LUFS target. | [decision] |
| Narration voice | First person (Tushar records it). The builder is not a weaver; no line implies weaving expertise or loom testing. | [decision] |
| Vertical_Cut content | A 40-second edit: the problem line, the peacock built and woven, the Cloth view, the close; captions from the same Script_Data cues. | [decision] |
