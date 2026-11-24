// Scene 4, the honest close (2:32 to 2:48): what is not tested, what the motif step is, the links,
// and "Built with Kiro" in text. No logos.
import { Enter, Heading, Stock } from "../parts";
import { LIVE_URL, REPO_URL } from "../script";
import { COLOURS, FONTS } from "../theme";

export function CloseScene({ compact = false }: { readonly compact?: boolean }) {
  const line = { fontFamily: FONTS.sans, fontSize: compact ? 40 : 44, color: COLOURS.ink, marginTop: 18 } as const;
  const mono = { fontFamily: FONTS.mono, fontSize: compact ? 30 : 36, color: COLOURS.walnut, marginTop: 14 } as const;
  return (
    <Stock>
      <div style={{ position: "absolute", left: compact ? 70 : 160, right: compact ? 70 : 160, top: compact ? 520 : 150 }}>
        <Enter>
          <Heading size={compact ? 96 : 120} style={{ letterSpacing: 6 }}>
            JACQUARD
          </Heading>
        </Enter>
        <Enter delay={12}>
          <div style={line}>The card format is a configurable loom profile, not yet tested on a working loom.</div>
        </Enter>
        {/* With "The site is live and the code is open source" (part 2, 7 s in). */}
        <Enter delay={210} style={{ marginTop: 40 }}>
          <div style={mono}>{LIVE_URL.replace("https://", "")}</div>
          <div style={mono}>{REPO_URL.replace("https://", "")} · open source, MIT licence</div>
        </Enter>
        {/* With "Built with Kiro" (part 3, 13.9 s in). */}
        <Enter delay={417}>
          <div style={{ fontFamily: FONTS.display, fontSize: compact ? 52 : 60, fontWeight: 600, color: COLOURS.brassStrong, marginTop: 50 }}>Built with Kiro</div>
        </Enter>
      </div>
    </Stock>
  );
}
