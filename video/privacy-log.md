# Privacy log for the demo video (demo-video 4.1, 4.2)

Every asset the video uses, the part used, what was checked and any crop or drop. Checked frame by frame at 1 frame a second over each range used (tiled contact sheets), plus full-size frames at the start and middle of each range. Checked for: email addresses, AWS account ids, ARNs, names of other projects, browser profiles, Slack or mail content, and (since the second review) home-directory paths, the user name and the host name.

Never used: `media/journey/autopilot/`, the long recordings in `media/journey` (`engine-final-tasks`, `guard-test-and-wave6`, `hooks-live-test`, `hooks-retest`, `planted-bug-demo`, `wave*`, `waves*`), and every `clip-browser-*` clip.

| Asset | Part used | Found | Action |
|---|---|---|---|
| `video/public/capture/live.mp4` (new Playwright capture of the Live_URL) | 0.2 to 59.6 s | Page viewport only (CDP screencast): no browser chrome, tabs, profile or OS UI. A walnut pointer drawn by `capture/cursor.js`. Re-checked in the second review at 1 frame every 2 s (30 tiles): the app only, no path, no name | None needed |
| `video/public/capture/live-audio.wav` | the weave and Cloth view segments | The app's own tone sounds | None needed |
| `media/journey/2026-11-16-clip-hooks-firing-live-wave7.mp4` → `public/media/hooks-log.mp4` | 16.5 to 21.5 s | **Review finding (second review):** the earlier full-window crop (`hooks.mp4`) showed the terminal prompt with my user name and host name, and `/Users/...` paths in the agent panel | Replaced by a tight crop, `crop=762:278:478:822`, of the `hook-runs.log` lines only. It starts below the prompt line and leaves out the agent panel. Checked at 1 frame a second over the whole range (5 tiles): log lines only, no prompt, no path, no name |
| same clip → `public/media/hooks-panel.png` | frame at 22 s | The "Run Command Hook" box above the crop shows a `/Users/...` path | Crop `crop=486:142:1376:588` holds only the two "Run Command Hook" headers and hook names, below that box. Checked full size: no path, no name |
| `media/journey/2026-11-16-clip-lattice-test-finds-design-error.mp4` | 87.5 to 95 s | Same as above. From about 100 s on, another app's window shows a sidebar with the names of other projects | Only 87.5 to 95 s used (all Kiro, checked); cropped to the agent's "Input required" panel (572x700 at 1334, 240) → `lattice-panel.mp4`. Re-checked in the second review at 1 frame a second (8 tiles): panel text only, no path, no name |
| `media/journey/2026-11-16-clip-kiro-drives-chrome-devtools-mcp.mp4` | 66 to 80 s | Chrome tabs and address bar, a browser profile button beside the address bar, a macOS "Privacy & Security" notification, the menu bar, the Dock | Cropped to the page (1566x940 at 30, 185): tabs, address bar, profile button, notification, menu bar and Dock removed. The "Chrome is being controlled by automated test software" bar stays: it is the point of the clip. Re-checked in the second review at 1 frame a second (14 tiles): page and the automation bar only, no path, no name |
| `media/motif-builder/paisley-border-paper-1440.png` | whole | Our app only (live site screenshot). Re-checked full size in the second review | None needed |
| `media/polish/weave-cloth-peacock-1440.png` | whole | Our app only. Re-checked full size in the second review | None needed |
| `media/polish/weave-1440.png` as it was at tag `phase-polish` (commit ca00bff) | whole | Our app only. Re-checked full size in the second review | None needed (read from git history; the same file, before the review) |
| Repo excerpts (`public/data/excerpts.json`) | the lines shown | `mcp.json` holds local paths | Only the server names are read from `mcp.json`; from the Kiro CLI log only the `VERDICT: PASS` line |
| `public/data/problem.json` | whole | Engine and export output for the Peacock butta gallery design | None needed |
| `public/audio/*.wav` | whole | Composed in code (`video/audio/score.ts`), effects from the app's patches | None needed |

## Second review (privacy and figures)

- Removed from the video: `hooks.mp4` (the full-window hooks crop that showed the prompt and paths), `lattice.mp4` and `planted-bug.png` (not used).
- `prepare-assets.ts` fails the build if the repo excerpts or `problem.json` contain `/Users/`, `techtush`, `@192`, `Tushar Agarwal` or the 42,000-cards figure (`42[,.]?000`).
- The same patterns were searched over `video/src`, `video/public/data` and `script.md`: no match.
- The 42,000-cards figure is not shown or said anywhere in the video.

## Final renders (synthetic narration, 2026-11-24)

- `video/out/jacquard-demo.mp4` (168.9 s) and `video/out/jacquard-demo-vertical.mp4` (44.4 s) were checked at 1 frame every 2 s (contact sheets: 85 and 23 frames). Every frame shows the app, repo files rendered by Remotion, or the crops listed above. No home-directory path, user name, host name, email address, AWS account id, ARN or Amplify console URL. The only URLs are the live amplifyapp.com address and the GitHub repository.
- After that check the tally chip and line 14 changed from 96 to 99 property-based tests; the frame at 95 s was checked again.
- New on screen: the end card's "Narration: synthetic voice (Kokoro-82M)", in both cuts.
- The voice is generated locally (`video/voice/tts/`); nothing was sent to a cloud service. Model weights are cached in `~/.cache/jacquard-tts`, outside git.
