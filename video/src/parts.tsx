// Shared pieces in the app's design language (demo-video 6.1): card stock, walnut, brass, the
// three typefaces, small radii. Motion helpers only ease something into place.
import type { CSSProperties, ReactNode } from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { COLOURS, FONTS } from "./theme";

export function Stock({ children, style }: { readonly children?: ReactNode; readonly style?: CSSProperties }) {
  return (
    <div style={{ position: "absolute", inset: 0, background: COLOURS.room, fontFamily: FONTS.sans, color: COLOURS.ink, overflow: "hidden", ...style }}>
      {children}
    </div>
  );
}

/** Fades and lifts in over `frames` from `delay`. */
export function useEnter(delay = 0, frames = 10): { opacity: number; transform: string } {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [delay, delay + frames], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return { opacity: t, transform: `translateY(${(1 - t) * 16}px)` };
}

export function Enter({ delay = 0, children, style }: { readonly delay?: number; readonly children: ReactNode; readonly style?: CSSProperties }) {
  const enter = useEnter(delay);
  return <div style={{ ...style, ...enter }}>{children}</div>;
}

/** A panel like the app's: raised card stock, a hairline border, a small radius. */
export function Panel({ title, children, style }: { readonly title?: ReactNode; readonly children: ReactNode; readonly style?: CSSProperties }) {
  return (
    <div
      style={{
        background: COLOURS.surface,
        border: `1px solid ${COLOURS.line}`,
        borderRadius: 8,
        boxShadow: "0 1px 2px rgb(60 40 20 / 0.12), 0 18px 40px -20px rgb(60 40 20 / 0.45)",
        overflow: "hidden",
        ...style,
      }}
    >
      {title === undefined ? null : (
        <div style={{ background: COLOURS.walnut, color: COLOURS.onPrimary, fontFamily: FONTS.mono, fontSize: 24, padding: "12px 22px" }}>{title}</div>
      )}
      <div style={{ padding: 24 }}>{children}</div>
    </div>
  );
}

/** A file excerpt in IBM Plex Mono; label tokens like [sourced] are set in brass. */
export function Code({ text, size = 26, highlight }: { readonly text: string; readonly size?: number; readonly highlight?: RegExp }) {
  const pattern = highlight ?? /(\[(?:sourced|convention|decision|to verify)[^\]]*\])/g;
  const parts = text.split(pattern);
  return (
    <div style={{ fontFamily: FONTS.mono, fontSize: size, lineHeight: 1.45, whiteSpace: "pre-wrap", wordBreak: "break-word", color: COLOURS.ink }}>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <span key={index} style={{ color: COLOURS.brassStrong, background: "#f3e4bd", borderRadius: 3, padding: "0 4px", fontWeight: 600 }}>
            {part}
          </span>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </div>
  );
}

export function Chip({ children, strong = false }: { readonly children: ReactNode; readonly strong?: boolean }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "10px 22px",
        borderRadius: 999,
        border: `2px solid ${COLOURS.brass}`,
        background: strong ? COLOURS.brass : COLOURS.raised,
        color: strong ? COLOURS.onPrimary : COLOURS.ink,
        fontFamily: FONTS.sans,
        fontSize: 30,
        fontWeight: 600,
      }}
    >
      {children}
    </span>
  );
}

export function Heading({ children, size = 64, style }: { readonly children: ReactNode; readonly size?: number; readonly style?: CSSProperties }) {
  return <div style={{ fontFamily: FONTS.display, fontSize: size, fontWeight: 600, lineHeight: 1.1, color: COLOURS.ink, ...style }}>{children}</div>;
}
