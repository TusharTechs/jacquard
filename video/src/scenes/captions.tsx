// Burned-in captions (demo-video 2.6): the cues made from the narration, the same ones the .srt
// holds. A walnut band, Instrument Sans, two lines at most.
import { useCurrentFrame } from "remotion";
import type { Cue } from "../cues";
import { COLOURS, FONTS, FPS } from "../theme";

export function Captions({ cues, offset = 0, size = 40, bottom = 46 }: { readonly cues: readonly Cue[]; readonly offset?: number; readonly size?: number; readonly bottom?: number }) {
  const t = useCurrentFrame() / FPS + offset;
  const cue = cues.find((item) => t >= item.start && t < item.end);
  if (cue === undefined) return null;
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
      <div
        style={{
          background: "rgb(42 31 22 / 0.92)",
          color: COLOURS.onPrimary,
          fontFamily: FONTS.sans,
          fontSize: size,
          fontWeight: 500,
          lineHeight: 1.3,
          padding: "14px 30px",
          borderRadius: 8,
          textAlign: "center",
          maxWidth: "86%",
        }}
      >
        {cue.lines.map((line, index) => (
          <div key={index}>{line}</div>
        ))}
      </div>
    </div>
  );
}
