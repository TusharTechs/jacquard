// Scene 3, how Kiro built it (1:26 to 2:32). Repo files are shown as they are (excerpts read by
// prepare-assets.ts); footage is Allowed_Footage, cropped as privacy-log.md records. Numbers come
// from the running tally in KIRO_JOURNEY.md (TALLY below, with its source).
import type { ReactNode } from "react";
import { Img, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import type { Excerpts } from "../data";
import { Chip, Code, Enter, Heading, Panel, Stock } from "../parts";
import { COLOURS, FONTS, FPS } from "../theme";

/** KIRO_JOURNEY.md, "Running tally", 2026-11-24 (demo-video wave 0). */
export const TALLY = { specs: 9, properties: 93, hooks: 3, agents: 5, mcp: 4 } as const;

function Label({ children }: { readonly children: ReactNode }) {
  return <div style={{ fontFamily: FONTS.mono, fontSize: 26, color: COLOURS.inkMuted, letterSpacing: 0.2 }}>{children}</div>;
}

function Arrow() {
  return <div style={{ fontFamily: FONTS.sans, fontSize: 40, color: COLOURS.brass, textAlign: "center", margin: "6px 0" }}>↓</div>;
}

/** 86 to 95.9: a requirement, the property that validates it, the task that tests it. */
function SpecChain({ excerpts }: { readonly excerpts: Excerpts }) {
  const [requirement, property, task] = excerpts.specChain;
  return (
    <Stock>
      <div style={{ position: "absolute", left: 140, right: 140, top: 60 }}>
        <Enter>
          <Panel title={`${requirement!.file}:${requirement!.line}`}>
            <Code text={requirement!.text} size={28} />
          </Panel>
        </Enter>
        <Enter delay={36}>
          <Arrow />
          <Panel title={`${property!.file}:${property!.line}`}>
            <Code text={property!.text} size={24} />
          </Panel>
        </Enter>
        <Enter delay={72}>
          <Arrow />
          <Panel title={`${task!.file}:${task!.line}`}>
            <Code text={task!.text} size={24} />
          </Panel>
        </Enter>
      </div>
      <Enter delay={110} style={{ position: "absolute", left: 140, right: 140, top: 860, display: "flex", gap: 18, flexWrap: "wrap" }}>
        <Chip strong>{TALLY.specs} specs</Chip>
        <Chip strong>{TALLY.properties} property-based tests</Chip>
        <Chip>{TALLY.hooks} hooks</Chip>
        <Chip>{TALLY.agents} custom agents</Chip>
        <Chip>{TALLY.mcp} MCP servers</Chip>
      </Enter>
    </Stock>
  );
}

/** 95.9 to 98.5: steering with its labels. */
function Steering({ excerpts }: { readonly excerpts: Excerpts }) {
  return (
    <Stock>
      <div style={{ position: "absolute", left: 140, right: 140, top: 80 }}>
        <Panel title=".kiro/steering/weaving-domain.md">
          {excerpts.steering.map((line, index) => (
            <div key={index} style={{ marginBottom: 18 }}>
              <Code text={line} size={25} />
            </div>
          ))}
        </Panel>
      </div>
    </Stock>
  );
}

/** 98.5 to 107.5: the hooks, off until the workspace was trusted, then firing live. */
function Hooks({ excerpts }: { readonly excerpts: Excerpts }) {
  const frame = useCurrentFrame();
  const trust = interpolate(frame, [0, 12, 150, 166], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <Stock>
      <div style={{ position: "absolute", left: 60, top: 40, width: 1240, height: 687, borderRadius: 8, overflow: "hidden", boxShadow: "0 18px 40px -20px rgb(60 40 20 / 0.55)" }}>
        <OffthreadVideo src={staticFile("media/hooks.mp4")} muted style={{ width: "100%", height: "100%" }} />
      </div>
      <div style={{ position: "absolute", left: 1340, top: 40, width: 520 }}>
        <Label>.kiro/hooks/</Label>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 14 }}>
          {excerpts.hookNames.map((name) => (
            <Chip key={name}>{name}</Chip>
          ))}
        </div>
      </div>
      <div style={{ position: "absolute", left: 60, right: 60, top: 760, opacity: trust }}>
        <Panel title="Kiro log">
          <Code text="hooks.v2.executionDisabledUntrustedWorkspace" size={34} highlight={/(executionDisabledUntrustedWorkspace)/} />
        </Panel>
      </div>
    </Stock>
  );
}

/** 107.5 to 114.8: the lattice test that proved the design document wrong. */
function Lattice() {
  return (
    <Stock>
      <div style={{ position: "absolute", left: 140, top: 30, width: Math.round((820 * 572) / 700), height: 820 }}>
        <OffthreadVideo src={staticFile("media/lattice-panel.mp4")} muted style={{ width: "100%", height: "100%", borderRadius: 8 }} />
      </div>
      <div style={{ position: "absolute", left: 1000, top: 300, width: 800 }}>
        <Heading size={56}>The design was wrong, not the code</Heading>
        <div style={{ marginTop: 24 }}>
          <Label>weave-engine task 11.4 · a Kiro sub-agent stopped and asked</Label>
        </div>
      </div>
    </Stock>
  );
}

/** 114.8 to 118.3: the planted bug's shrunk counterexample. */
function Planted({ excerpts }: { readonly excerpts: Excerpts }) {
  const counterexample = excerpts.planted.find((line) => line.startsWith("- Counterexample")) ?? "";
  const lifts = /"lifts":\[\[true\],\[false\]\]/.exec(counterexample)?.[0] ?? "";
  return (
    <Stock>
      <div style={{ position: "absolute", left: 140, right: 140, top: 200 }}>
        <Heading size={56}>A planted off-by-one, shrunk</Heading>
        <div style={{ marginTop: 30 }}>
          <Panel title="KIRO_JOURNEY.md · Property 23">
            <Code text={`pickCount: 2 · designWidth: 1 · maxWarpFloat: 1\n${lifts}`} size={40} highlight={/("lifts":\[\[true\],\[false\]\])/} />
          </Panel>
        </div>
        <div style={{ marginTop: 24 }}>
          <Label>float not over limit 1 · found after 4 tests, shrunk 17 times</Label>
        </div>
      </div>
    </Stock>
  );
}

/** 118.3 to 125.1: the mirrored paisley border that lost its figures, and the fixed one. */
function Paisley({ excerpts }: { readonly excerpts: Excerpts }) {
  const counterexample = (excerpts.paisley.find((line) => line.startsWith("Counterexample")) ?? "").replace(/^Counterexample:\s*/, "").replace(/`/g, "");
  const error = (excerpts.paisley.find((line) => line.startsWith("Error")) ?? "").replace(/^Error:\s*/, "").replace(/`/g, "");
  return (
    <Stock>
      <div style={{ position: "absolute", left: 80, top: 70, width: 900 }}>
        <Panel title="Property 2 · seed 6102 · first run">
          <Code text={counterexample} size={26} highlight={/("symmetry":"mirrorPicks")/} />
          <div style={{ height: 18 }} />
          <Code text={error} size={26} />
        </Panel>
      </div>
      <Enter delay={60} style={{ position: "absolute", left: 1020, top: 70, width: 820 }}>
        <Img src={staticFile("media/paisley-fixed.png")} style={{ width: "100%", borderRadius: 8, boxShadow: "0 18px 40px -20px rgb(60 40 20 / 0.55)" }} />
        <div style={{ marginTop: 14 }}>
          <Label>after the fix: the figures stay</Label>
        </div>
      </Enter>
    </Stock>
  );
}

/** 125.1 to 135.9: custom agents and the MCP servers; Kiro driving Chrome through DevTools. */
function AgentsMcp({ excerpts }: { readonly excerpts: Excerpts }) {
  return (
    <Stock>
      <div style={{ position: "absolute", left: 60, top: 60, width: 1160, height: 696, borderRadius: 8, overflow: "hidden", boxShadow: "0 18px 40px -20px rgb(60 40 20 / 0.55)" }}>
        <OffthreadVideo src={staticFile("media/chrome-mcp.mp4")} muted style={{ width: "100%", height: "100%" }} />
      </div>
      <div style={{ position: "absolute", left: 60, top: 780 }}>
        <Label>Kiro driving Chrome through the Chrome DevTools MCP server</Label>
      </div>
      <div style={{ position: "absolute", left: 1270, top: 60, width: 600 }}>
        <Label>custom agents</Label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12 }}>
          {excerpts.agents.map((name) => (
            <Chip key={name}>{name}</Chip>
          ))}
        </div>
        <div style={{ height: 40 }} />
        <Label>MCP servers</Label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12 }}>
          {excerpts.mcp.map((name) => (
            <Chip key={name} strong={name === "jacquard-weave"}>
              {name}
            </Chip>
          ))}
        </div>
        <div style={{ marginTop: 16 }}>
          <Label>jacquard-weave is ours</Label>
        </div>
      </div>
    </Stock>
  );
}

/** 135.9 to 144.9: the Power and the local Kiro CLI run. */
function PowerCli({ excerpts }: { readonly excerpts: Excerpts }) {
  return (
    <Stock>
      <div style={{ position: "absolute", left: 140, right: 140, top: 150, display: "flex", gap: 40 }}>
        <Enter style={{ flex: 1 }}>
          <Panel title="power/plugin.json">
            <Code text={`Power: ${excerpts.power}\nMCP server bundled · 2 skills`} size={34} />
          </Panel>
        </Enter>
        <Enter delay={50} style={{ flex: 1 }}>
          <Panel title="kiro-cli · spec-checker · headless">
            <Code text={`${excerpts.cliVerdict}\nrun on my machine`} size={34} highlight={/(VERDICT: PASS)/} />
          </Panel>
        </Enter>
      </div>
      <Enter delay={110} style={{ position: "absolute", left: 140, right: 140, top: 560 }}>
        <Label>The GitHub Actions run is set up but off: Kiro API keys need a paid Kiro plan.</Label>
      </Enter>
    </Stock>
  );
}

/** 144.9 to 152: what Kiro missed. The cloth before and after the review. */
function ClothBeforeAfter() {
  return (
    <Stock>
      <div style={{ position: "absolute", left: 60, right: 60, top: 70, display: "flex", gap: 40 }}>
        {[
          ["media/cloth-before.png", "before my review: the cloth woven, the design barely there"],
          ["media/cloth-after.png", "after: repeat across, and a Cloth view"],
        ].map(([src, label], index) => (
          <Enter key={src} delay={index * 45} style={{ flex: 1 }}>
            <Img src={staticFile(src!)} style={{ width: "100%", borderRadius: 8, boxShadow: "0 18px 40px -20px rgb(60 40 20 / 0.55)" }} />
            <div style={{ marginTop: 16 }}>
              <Label>{label}</Label>
            </div>
          </Enter>
        ))}
      </div>
    </Stock>
  );
}

const PARTS: readonly { readonly at: number; readonly until: number; readonly render: (excerpts: Excerpts) => ReactNode }[] = [
  { at: 86, until: 95.9, render: (excerpts) => <SpecChain excerpts={excerpts} /> },
  { at: 95.9, until: 98.5, render: (excerpts) => <Steering excerpts={excerpts} /> },
  { at: 98.5, until: 107.5, render: (excerpts) => <Hooks excerpts={excerpts} /> },
  { at: 107.5, until: 114.8, render: () => <Lattice /> },
  { at: 114.8, until: 118.3, render: (excerpts) => <Planted excerpts={excerpts} /> },
  { at: 118.3, until: 125.1, render: (excerpts) => <Paisley excerpts={excerpts} /> },
  { at: 125.1, until: 135.9, render: (excerpts) => <AgentsMcp excerpts={excerpts} /> },
  { at: 135.9, until: 144.9, render: (excerpts) => <PowerCli excerpts={excerpts} /> },
  { at: 144.9, until: 152, render: () => <ClothBeforeAfter /> },
];

export function KiroScene({ origin, excerpts }: { readonly origin: number; readonly excerpts: Excerpts }) {
  return (
    <>
      {PARTS.map((part) => (
        <Sequence key={part.at} from={Math.round((part.at - origin) * FPS)} durationInFrames={Math.round((part.until - part.at) * FPS)}>
          {part.render(excerpts)}
        </Sequence>
      ))}
    </>
  );
}
