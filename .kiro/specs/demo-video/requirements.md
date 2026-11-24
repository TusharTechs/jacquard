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
2. Script_Data SHALL hold the narration per scene; `video/script.md` SHALL be generated from it locally (gitignored, not committed) with narration, word count and timing per scene at about 140 words a minute (Property 1).
3. Problem claims SHALL be only what `product.md` and `weaving-domain.md` allow, with their labels recorded in Script_Data; no invented statistics. Numbers about the build SHALL come only from the running tally of `KIRO_JOURNEY.md`.
4. "How Kiro built it" SHALL cover specs (requirements to properties to tasks), steering, hooks, custom agents, MCP (jacquard-weave, Chrome DevTools, AWS Documentation), property-based tests, the Power, the local Kiro CLI run (saying that API keys need a paid plan), and the Amplify deploy driven by Kiro, built around 3 or 4 "Surprise" moments from `KIRO_JOURNEY.md`.
5. THE close SHALL say the card format has not been tested on a working loom, that the motif step is a builder, not AI, and show the Live_URL, the repo and "Built with Kiro".
6. Captions SHALL be burned in from the same text as the narration, and an `.srt` SHALL be generated from it (Property 2).
7. The narration SHALL be a synthetic voice made locally with Kokoro-82M from Script_Data's words, unchanged (first person, Tushar's script), as Tushar chose on 2026-11-24; it SHALL be disclosed on the end card and in the README (Requirement 9). Until the voice track exists, the narration track SHALL be silent and captions shown.

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

### Requirement 8: Voice assembly from recorded lines
1. THE narration SHALL be one file per narration part: `video/voice/lines/NN.wav`, where NN is the part's number in order through the whole video (01 to the last), at any sample rate, mono or stereo, made by the synthetic voice (Requirement 9) or recorded by a person. These files SHALL be gitignored.
2. `video/voice/RECORDING.md` SHALL be generated locally from Script_Data (gitignored, not committed): a numbered list of every part with its exact text and target seconds, and tips for recording a line by hand (quiet room, phone or laptop mic about 20 cm away, an easy pace, 1 s of silence before and after, re-record a line by overwriting its file).
3. `pnpm --filter @jacquard/video voice` SHALL trim leading and trailing silence from each line, normalise the voice to −16 LUFS, place each line so its speech starts at its part's start, and write `public/audio/voice.wav` at 48 kHz.
4. IF a line is longer than its part's window, THEN it SHALL be sped up by at most 5 % without a change of pitch; IF it still does not fit, THEN the script SHALL fail, list every such line's number, length and window, and write nothing. Words SHALL never be cut (Properties 4 and 5).
5. AFTER assembly, the script SHALL set `assets.voice` to true and run the loudness check against the real voice track: in every part, the rest of the mix at least 18 dB under the voice.
6. Tests SHALL cover the placement (Property 6) and the overrun report, with synthetic tones as input (the tests need no speech model).
### Requirement 9: Synthetic narration
1. THE voice SHALL be Kokoro-82M (Apache-2.0), run locally: a Python 3.12 venv made with uv under `video/voice/tts/`, exact pinned versions each published at least 14 days before 2026-11-24, the lockfile committed; weights from `hexgrad/Kokoro-82M` on Hugging Face at a pinned revision, cached outside git. No cloud TTS, account, API key or AWS service.
2. 3 or 4 English voices SHALL be tried on lines 01, 07, 18 and 21 (`video/out/voice-samples/`, gitignored), and one voice used for all lines; the choice and the reason SHALL be in the journal.
3. `pnpm --filter @jacquard/video tts` SHALL write `voice/lines/01.wav` to the last from Script_Data's text, sentence by sentence, never word by word, with pronunciation overrides where needed (JACQUARD and jacquard "juh-KARD", Kiro "KEER-oh", WIF "wiff", MCP, AWS and CLI as letters, and any other word heard wrong). After Tushar's final review: unhurried, at a speed per line between 0.8 and 1.05, with a natural pause of 0.25 to 0.4 s between sentences inside a line, aiming at about 150 to 160 words a minute and at each line's speech filling about 85 to 95 % of its window.
4. EACH generated line SHALL be transcribed with a local speech-recognition model at a pinned revision and compared with its script text; a line whose transcript differs in more than punctuation SHALL be fixed and made again. Each line's match and length SHALL be logged.
5. IF lines overrun after the 5 % stretch, THEN time SHALL come from the gaps between parts and the music-only moments, with the beats moved with it; the Main_Cut MAY grow to at most 2:55. Words SHALL never be cut.
6. THE burned-in captions and the `.srt` SHALL be timed to where each line, and each sentence, is actually spoken after trimming.
7. A 960x540 sync check SHALL log the caption-to-voice offset at every line start, each at most 0.2 s. The final Main_Cut SHALL be 1920x1080, 30 fps, H.264, about −16 LUFS integrated, with the rest of the mix at least 18 dB under the voice in every line.
8. THE end card SHALL say, in small text, "Narration: synthetic voice (Kokoro-82M)"; the README SHALL have a Credits line naming Kokoro-82M and its Apache-2.0 licence.
9. THE Vertical_Cut (1080x1920, 45 s or less) SHALL use lines 01, 03 to 04, 06 to 07, 11 to 12 and 26 in the same voice and at the same loudness target, built for a phone: each capture cropped to the part of the UI that matters and scaled to the full width (the Describe panel with its chips, the point paper with the peacock drawn, the 3D loom, the Cloth view), never a full page shrunk into a strip; the peacock on the point paper while "and draws it on point paper" plays; captions of at least 56 px in the lower third, with a caption up whenever the voice plays; and its own vertical end card with JACQUARD, "Built with Kiro", the Live_URL and "Narration: synthetic voice (Kokoro-82M)".
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
| Narration voice | First person (Tushar's script). The builder is not a weaver; no line implies weaving expertise or loom testing. | [decision] |
| Vertical_Cut content | A 40-second edit: the problem line, the peacock built and woven, the Cloth view, the close; captions from the same Script_Data cues. | [decision] |
| The agents line (second review) | "Custom agents audited the work through our own MCP server. Chrome DevTools and AWS Documentation MCP servers helped Kiro check the app and deploy it to Amplify." (Tushar's wording, 27 words, 11.6 s at 140 wpm). The 1.6 s comes from the Kiro scene's spare: gaps after it are 0.3 s and the last part ends at 151.6 s; the Kiro narration is 140 words. | [decision] |
| Why one file per part? | A single continuous take does not line up with the timed captions or the ducking windows (Tushar's second review). Each part is its own file, placed at its part's start. | [decision] |
| Silence trimming | 10 ms frames; speech is above the noise floor (10th-percentile frame) + 10 dB, capped at the loudest frame − 30 dB and never below the loudest − 50 dB; 0.15 s kept around the speech; the speech starts at the part's start and the pads fall in the gaps. The cap came from Property 5's first run: without it a line with little silence was judged silent. | [decision] |
| Normalising and stretching | Each line to −16 LUFS (ffmpeg `ebur128`, then a gain and a −1 dBFS look-ahead limiter with delay compensation), so separately recorded lines match. Time-stretch with ffmpeg `atempo` (pitch kept). | [decision] |
| Loudness check with the real voice | Per part: the voice track's loudness in the part's window against a render of the Main_Cut with the voice muted (`--props={"voice":false}`, `--codec=wav`), which holds the score, the effects and the app's sound. | [decision] |
| Music margin under narration | 3 dB (the score at −21 dB under narration; it was 2 dB). With tone lines the 2 dB margin left line 01 at 16.5 dB and line 11 at 17.9 dB: the score stem is about 1 dB over −16 LUFS there, plus the card clack and the app's loom sound. The clack is now at 0.3 and the app's sound at 0.35; every part is then at least 19.2 dB under. | [decision] |
| Narration voice: synthetic | Kokoro-82M, Apache-2.0, chosen by Tushar on 2026-11-24, disclosed on the end card and in the README. | [decision] |
| Speech recognition for the check | faster-whisper 1.2.1 with `Systran/faster-whisper-medium.en` at revision a29b04bd (MIT), int8 on the CPU, no prompt (the transcript must come from the audio, not the script). Audio is decoded with ffmpeg, because faster-whisper's own decoder does not work with the locked PyAV 19. | [decision] |
| Package age | `[tool.uv] exclude-newer = 2026-11-10` in `voice/tts/pyproject.toml`, so no package in the lock (124) was published in the 14 days before 2026-11-24; the direct dependencies are pinned exactly. `en-core-web-sm` 3.8.0 (2024) is a direct wheel URL from explosion/spacy-models, which the age filter does not cover. | [decision] |
| What counts as a matching transcript | The same words after lower case, numbers as words, and punctuation, hyphens and spacing dropped. Also accepted, and logged per line: British or American spelling of the same word (stylised/stylized, labelled/labeled) and one homophone pair the transcriber cannot tell apart (too/two, for "too" only). When a whole line differs, each sentence is transcribed on its own and must match its sentence: the transcriber rewrote "the tests" as "the test" from the next sentence's "a lattice test". | [decision] |
| Speed (final review) | Each line aims at 88 % of its window (inside 85 to 95 %; the windows are planned at 140 wpm, so about 159 wpm): a first take at 1.0, then up to three more at the speed that would give 88 % if speech time goes as 1 / speed, inside 0.8 to 1.05. Replaces the first rule (natural pace, 0.9 floor), which left the narration at 175 wpm on average, filling 124 s of 169. | [decision] |
| Pause between sentences (final review) | Each sentence is cut to its speech plus 0.04 s either side (Kokoro adds about 0.3 s before and 0.45 s after), then 0.25 s of silence goes between sentences: about 0.33 to 0.36 s heard. | [decision] |
| Voice at the slower speed | Kept af_heart. At 0.8 every transcript still matches. Nine lines (03, 04, 05, 06, 08, 17, 22, 25, 26) still fill only 74 to 83 % of their windows at the 0.8 floor; am_michael at 0.8 filled 83 to 100 % of the same lines, but at a lower grade (C+ against A), and nobody here can listen, so the voice did not change. | [decision] |
| Vertical_Cut build | Its own composition (`src/vertical-cut.tsx`, plan in `src/vertical.ts`): each shot is a crop of the Main_Cut or of the capture scaled to 1080 wide in a 1080x1080 picture zone under the wordmark; the voice and app sound come from the same Main_Cut times; the score runs on, ducked under the voice. Shots: card chain (01), the long float on point paper (03), the flagged row and the unpunched card (04), the Describe box typing (06), the chips, then the drawn peacock (07, cut 0.12 s before the transcriber's "and" of "and draws"), the loom from capture 27.2 s (before that the canvas is still loading) with the app's sound (11), the Cloth view (12), the vertical end card (26). Each line keeps 0.1 s before its speech and 0.15 s after; the end card takes the time left of 44.9 s. Captions 58 px, at most 26 characters a line, box in the lower third. | [decision] |
| Takes | A seed per line (its number) makes each take repeatable; a line that fails the check is made again with new seeds at the same speed, then at nearby speeds. | [decision] |
| Overruns | None after the 5 % stretch. Line 21 (12.45 s at natural pace) was given 0.9 s of line 22's spare window instead of being sped up: 21 ends at 140.2 s, 22 starts at 140.5 s; the agents and Power beats moved with them. The Main_Cut stays 2:48. | [decision] |
| Generated review files | `video/script.md` and `video/voice/RECORDING.md` are made locally by `pnpm --filter @jacquard/video script` and are gitignored (the repository was prepared for judges on 2026-11-24); `src/script.ts` stays the one source. | [decision] |
