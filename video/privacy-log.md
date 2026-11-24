# Privacy log for the demo video (demo-video 4.1, 4.2)

Every asset the video uses, the part used, what was checked and any crop or drop. Checked frame by frame at 1 frame a second over each range used (tiled contact sheets), plus full-size frames at the start and middle of each range. Checked for: email addresses, AWS account ids, ARNs, names of other projects, browser profiles, Slack or mail content.

Never used: `media/journey/autopilot/`, the long recordings in `media/journey` (`engine-final-tasks`, `guard-test-and-wave6`, `hooks-live-test`, `hooks-retest`, `planted-bug-demo`, `wave*`, `waves*`), and every `clip-browser-*` clip.

| Asset | Part used | Found | Action |
|---|---|---|---|
| `video/public/capture/live.mp4` (new Playwright capture of the Live_URL) | 0.2 to 59.6 s | Page viewport only (CDP screencast): no browser chrome, tabs, profile or OS UI. A walnut pointer drawn by `capture/cursor.js` | None needed |
| `video/public/capture/live-audio.wav` | the weave and Cloth view segments | The app's own tone sounds | None needed |
| `media/journey/2026-11-16-clip-hooks-firing-live-wave7.mp4` | 18 to 30 s | macOS menu bar (clock, status icons), the Dock (app icons, including Mail and messaging apps, no content), Kiro's status bar with my name | Cropped to the Kiro window, 1920x1064 from y 46: menu bar and Dock removed. My own name in the status bar is cut by the same crop |
| `media/journey/2026-11-16-clip-lattice-test-finds-design-error.mp4` | 87.5 to 95 s | Same as above. From about 100 s on, another app's window shows a sidebar with the names of other projects | Only 87.5 to 95 s used (all Kiro, checked); cropped to the agent's "Input required" panel (572x700 at 1334, 240) |
| `media/journey/2026-11-16-clip-kiro-drives-chrome-devtools-mcp.mp4` | 66 to 80 s | Chrome tabs and address bar, a browser profile button beside the address bar, a macOS "Privacy & Security" notification, the menu bar, the Dock | Cropped to the page (1566x940 at 30, 185): tabs, address bar, profile button, notification, menu bar and Dock removed. The "Chrome is being controlled by automated test software" bar stays: it is the point of the clip |
| `media/journey/2026-11-16-planted-bug-counterexample.png` | prepared (cropped), not shown in the draft | Menu bar, Dock | Cropped to the Kiro window. The draft shows the journal's counterexample text instead |
| `media/motif-builder/paisley-border-paper-1440.png` | whole | Our app only (live site screenshot) | None needed |
| `media/polish/weave-cloth-peacock-1440.png` | whole | Our app only | None needed |
| `media/polish/weave-1440.png` as it was at tag `phase-polish` (commit ca00bff) | whole | Our app only | None needed (read from git history; the same file, before the review) |
| Repo excerpts (`public/data/excerpts.json`) | the lines shown | `mcp.json` holds local paths | Only the server names are read from `mcp.json`; from the Kiro CLI log only the `VERDICT: PASS` line |
| `public/data/problem.json` | whole | Engine and export output for the Peacock butta gallery design | None needed |
| `public/audio/*.wav` | whole | Composed in code (`video/audio/score.ts`), effects from the app's patches | None needed |
