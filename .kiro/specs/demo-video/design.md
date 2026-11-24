# Design Document: demo-video

## Layout

```
video/
├── package.json, tsconfig.json, remotion.config.ts, vitest.config.ts
├── script.md                 generated from src/script.ts (committed, for review)
├── privacy-log.md            every asset used, ranges, checks, crops
├── src/
│   ├── index.ts              registerRoot
│   ├── root.tsx              compositions: Main (1920x1080), Vertical (1080x1920), Storyboard stills
│   ├── script.ts             Script_Data: scenes, narration, beats, labels (no imports)
│   ├── cues.ts               captions: narration → cues; SRT writer and reader
│   ├── mix.ts                music gain envelope under narration
│   ├── voice.ts              voice lines, trimming, fit, placement, WAV writer, RECORDING.md (pure)
│   ├── tts.ts                synthetic voice: overrides, speed, transcript check (pure)
│   ├── voice-timing.ts       generated: where each line and sentence is spoken (committed)
│   ├── theme.ts              design tokens (checked against apps/web/src/styles.css)
│   ├── fonts.ts              Fontsource CSS imports
│   ├── assets.ts             paths of copied media and capture files
│   └── scenes/               problem.tsx, solution.tsx, kiro.tsx, close.tsx, captions.tsx, parts
├── capture/
│   ├── playwright.config.ts  headed Chromium, 1920x1080
│   ├── live.spec.ts          the scripted run on the Live_URL
│   ├── screencast.ts         CDP screencast to timestamped JPEG frames
│   ├── audio-tap.js          init script: Web Audio output → MediaRecorder
│   └── assemble.ts           frames + audio → public/capture/live.mp4 and a beat file
├── audio/
│   ├── score.ts              the score and effects, written for Tone.Offline
│   └── render-audio.ts       runs score.ts in headless Chromium, writes WAV stems
├── scripts/                  make-script-md, make-srt, prepare-assets, loudness, lufs, voice
├── voice/
│   ├── RECORDING.md          generated: the lines, targets, tips for recording one (committed)
│   ├── lines/NN.wav, NN.json (gitignored) one per part, and each sentence's range
│   └── tts/                  uv project (pyproject.toml, uv.lock, models.json, tts.py); .venv gitignored
├── test/                     vitest: properties 1 to 3, script, theme
├── public/                   (gitignored) copied media, capture, audio
└── out/                      (gitignored) storyboard, draft, final renders, srt
```

## Script_Data

```ts
interface Scene { id: "problem" | "solution" | "kiro" | "close"; title: string; start: number; end: number; narration: string; claims: { text: string; label: string; source: string }[]; beats: Beat[] }
interface Beat { at: number; until: number; kind: "capture" | "clip" | "still" | "repo" | "art"; ref: string; note: string }
```

Times are seconds from the start of the Main_Cut. Scenes are contiguous. `script.md` lists each scene's window, word count, the words-per-minute the window allows, the narration, the claims with labels, and the beats.

## Captions (`cues.ts`)

`cuesFor(text, start, end)`: split the narration into sentences, then into cues of at most two lines of 42 characters at word boundaries; give each cue a share of the window proportional to its word count; cues are contiguous and inside the window. `toSrt(cues)` writes numbered SRT with `HH:MM:SS,mmm`; `fromSrt` reads it back.

### Property 1: Caption cues keep the narration
For any narration (random words, punctuation, 1 to 400 words) and any window long enough for at least 0.25 s per cue, the cues' texts joined with spaces equal the narration with whitespace collapsed; every cue has at most two lines of at most 42 characters (a single longer word alone on its line excepted); cues are in order, contiguous, start at the window start and end at its end.
**Validates: Requirements 2.6**

### Property 2: SRT round trip
For any list of ordered, non-overlapping cues with millisecond times under 10 minutes and text without blank lines, `fromSrt(toSrt(cues))` equals the cues.
**Validates: Requirements 2.6**

## Sound (`mix.ts`, `audio/`)

The score: a slow, quiet piece in code (a drone on the tonic, a plucked figure on a pentatonic scale, a soft card-punch rhythm in the Problem scene), rendered with `Tone.Offline` in headless Chromium at 48 kHz. Effects for the Remotion-made scenes (card punch, loom tick, shuttle) use the patches in `apps/web/src/lib/loom-sound-patches.ts`. `musicGainDb(t, narrationWindows)` returns the score gain: −21 dB under narration (the stem is normalised to −16 LUFS, so the score sits at −37 LUFS, 21 dB under a −16 LUFS voice), ramping over 0.4 s outside each window to −10 dB in gaps.

### Property 3: Music stays 18 dB under the voice
For any set of narration windows inside 0 to 170 s and any time t inside a window, `musicGainDb(t) ≤ VOICE_LUFS − 18 − SCORE_REF_LUFS`; at every t the gain is finite and at most `GAP_DB` (−10 dB).
**Validates: Requirements 5.3**

The rendered music stem is also measured with ffmpeg `ebur128` (example test, run by the loudness script): integrated loudness under narration ≤ −34 LUFS.

## Voice (`voice.ts`, `scripts/voice.ts`)
`voiceLines()` numbers every part of every scene in order (01 to 26) with its text, start and window (end − start). `scripts/voice.ts` decodes each `voice/lines/NN.wav` with ffmpeg to mono 48 kHz float, then the pure `assembleVoice(inputs, processors, DURATION)`: `trimBounds` finds the speech; `planFit(speech, window)` gives `fits`, `stretch` (tempo = speech / window ≤ 1.05) or `overrun`; any overrun or silent line stops it with `overrunReport` and nothing is written; otherwise each clip (speech plus 0.15 s each side) is stretched if needed (`atempo`), normalised (−16 LUFS, limiter at −1 dBFS) and added to a silent track so the speech starts at the part's start. `encodeWav` writes 48 kHz mono 16-bit. Then `assets.voice` is set to true, the Main_Cut is rendered to WAV with the voice muted, and `underVoice` checks each part's window: voice − rest ≥ 18 dB.
### Property 4: A line fits its window, at most 5 % faster, or is reported
For any speech length and window (0.2 to 20 s): `fits` with tempo 1 when speech ≤ window; `stretch` with 1 < tempo ≤ 1.05 and speech / tempo ≤ window when speech ≤ 1.05 × window; `overrun` otherwise. An assembly with overrunning lines fails, lists every one with its number, length and window, and returns no track.
**Validates: Requirements 8.4**
### Property 5: Trimming never cuts the speech
For any tone of 0.3 to 3 s at amplitude 0.02 to 0.9, with 0 to 2 s of low noise before and after, `trimBounds` contains the whole tone and drops the noise to within one 10 ms frame of it.
**Validates: Requirements 8.3, 8.4**
### Property 6: Each line's speech starts at its part's start
For any set of tone lines (0.2 to 1.5 s of silence each side, 30 to 100 % of the window long), the assembled track is the video's length, each tone starts within one frame of its part's start and ends inside its window, and there is nothing but low noise between parts.
**Validates: Requirements 8.3, 8.6**
## Synthetic narration (`tts.ts`, `scripts/tts.ts`, `voice/tts/tts.py`)
`scripts/tts.ts` gives `tts.py synth` one job per line: the voice, a speed, a seed and the line's sentences (`splitSentences`, the captions' own splitter), each marked up with the overrides as misaki phonemes (`[JACQUARD](/ʤəkˈɑɹd/)`). `tts.py` calls Kokoro once per sentence and joins them, writing `NN.wav` (24 kHz) and `NN.json` (each sentence's sample range). Each line is measured with the voice assembly's own `trimBounds`; `chooseSpeed` picks the speed for a second take. `tts.py asr` transcribes every line (faster-whisper, no prompt); `checkLine` compares the transcript with the script, or each sentence's transcript with its sentence; failing lines get new takes (`retryTakes`). The report is `out/tts-report.json`. `scripts/voice.ts` then writes `src/voice-timing.ts`; `cuesForTimedParts` starts each sentence's cues where it is spoken, and `verticalParts` cuts the Vertical_Cut around the chosen lines' speech. `scripts/sync-check.ts` renders at 960x540 with only the voice, finds each line's onset in the render's audio and the caption band's change in its picture, and logs the offsets.
### Property 7: The speed stays in range and never slows a line only to fill time
For any speech length, window and word count, `chooseSpeed` is between 0.9 and 1.05; when the line fits and is not rushed it is the natural speed; when it does not fit it is not slower than natural.
**Validates: Requirements 9.3**
### Property 8: Captions follow the voice and keep the narration
For any voice timing of the 26 lines (each sentence in order inside its line, lines in order), the timed cues' texts joined equal the narration, cues are in order and do not overlap, and each line's first cue starts where its speech starts.
**Validates: Requirements 9.6**
### Property 9: The Vertical_Cut holds the chosen lines in 45 s
For any voice timing, the Vertical_Cut's parts are in order, do not overlap, last 45 s or less, and each chosen line's speech lies inside a part.
**Validates: Requirements 9.9**
## Capture

`live.spec.ts` uses one page at 1920x1080, `deviceScaleFactor` 1, headed Chromium with `--autoplay-policy=no-user-gesture-required`. The audio tap is added with `addInitScript`. Steps (each logs a beat with `Date.now()`): open the Live_URL with storage cleared so the Opening shows; wait for the Opening; type the peacock description at a readable speed; Generate; wait for the reveal; Continue to Check; wait on the pulsing violations; Auto-fix; Continue to Weave; turn sound on; Play at 1×, then 2×; wait for the Cloth view; Continue to Cards; let the chain punch; Print (the print dialog is suppressed by stubbing `window.print` and the print stylesheet is shown with `page.emulateMedia({ media: "print" })` for two seconds); WIF export (the download is caught by Playwright). `assemble.ts` writes `public/capture/live.mp4` (frames at their timestamps, resampled to 30 fps, H.264 CRF 16), `public/capture/live-audio.wav`, and `public/capture/beats.json` (beat times relative to the first frame).

## Remotion

Compositions: `Main` (1920x1080, 30 fps, duration from Script_Data), `Vertical` (1080x1920, ≤ 45 s), and `Still-<scene>` for the storyboard. Scenes use `OffthreadVideo` for footage (with `startFrom` from beats.json), `Img` for stills, and React views of repo files (spec excerpts, steering, hook JSON, test output) set in IBM Plex Mono on card stock. Captions sit in a walnut band at the bottom (Instrument Sans, 40 px, two lines). Transitions are cuts or 8-frame fades; motion only for pointing at the thing being said.

Draft: `remotion render Main --scale=0.5 --crf=28`. Final: `--crf=18 --codec=h264`, `--pixel-format=yuv420p`.
