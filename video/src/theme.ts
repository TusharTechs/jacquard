// The app's design language for the video (demo-video 6.1): the same colour tokens and type as
// apps/web/src/styles.css. test/theme.test.ts checks every value against that file.
export const COLOURS = {
  room: "#e9dfcb",
  surface: "#f6f0e2",
  raised: "#fffaf0",
  sunk: "#ebe1cc",
  ink: "#1f1a14",
  inkMuted: "#5a4f42",
  line: "#d3c6a8",
  lineStrong: "#857452",
  walnut: "#5b3a24",
  brass: "#8a6420",
  brassStrong: "#6e4f17",
  primary: "#4a2e1b",
  onPrimary: "#fbf3e2",
  paper: "#fbf7ee",
  violation: "#d6006f",
} as const;

/** CSS custom property names in styles.css for each colour token. */
export const CSS_NAMES: Readonly<Record<keyof typeof COLOURS, string>> = {
  room: "--room",
  surface: "--surface",
  raised: "--raised",
  sunk: "--sunk",
  ink: "--ink",
  inkMuted: "--ink-muted",
  line: "--line",
  lineStrong: "--line-strong",
  walnut: "--walnut",
  brass: "--brass",
  brassStrong: "--brass-strong",
  primary: "--primary",
  onPrimary: "--on-primary",
  paper: "--paper",
  violation: "--violation",
};

export const FONTS = {
  display: '"Fraunces Variable", "Iowan Old Style", Georgia, serif',
  sans: '"Instrument Sans Variable", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  mono: '"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
} as const;

export const FPS = 30;
export const MAIN = { width: 1920, height: 1080 } as const;
export const VERTICAL = { width: 1080, height: 1920 } as const;
