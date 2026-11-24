// Scene 3, how Kiro built it (1:26 to 2:32). Repo files are shown as they are (excerpts read by
// prepare-assets.ts); footage is Allowed_Footage, cropped as privacy-log.md records. Numbers come
// from the running tally in KIRO_JOURNEY.md (TALLY below, with its source).
import type { ReactNode } from "react";
import { Img, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import type { Excerpts } from "../data";
import { Chip, Code, Enter, Heading, Panel, Stock } from "../parts";
import { COLOURS, FONTS, FPS } from "../theme";

/** KIRO_JOURNEY.md, "Running tally", 2026-11-24 (demo-video wave 0). */
export const TALLY = { specs: 9, properties: 99, hooks: 3, agents: 5, mcp: 4 } as const;

function Label({ children }: { readonly children: ReactNode }) {
  return <div style={{ fontFamily: FONTS.mono, fontSize: 26, color: COLOURS.inkMuted, letterSpacing: 0.2 }}>{children}</div>;
}

function Arrow() {
  return <div style={{ fontFamily: FONTS.sans, fontSize: 40, color: COLOURS.brass, textAlign: "center", margin: "6px 0" }}>↓</div>;
}

/** 86 to 96.2: a requirement, the property that validates it, the task that tests it. */
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

/** 96.2 to 100.4: one labelled line of steering, large. */
function Steering({ excerpts }: { readonly excerpts: Excerpts }) {
  const line = excerpts.steering.find((item) => item.includes("Handlooms still weaving")) ?? excerpts.steering[0]!;
  // "- Handlooms still weaving from punched cards: **[sourced, S2, S3]** (…)": the claim and its label.
  const claim = line.replace(/^-\s*/, "").replace(/\*\*/g, "").replace(/\s*\(.*$/, "");
  return (
    <Stock>
      <div style={{ position: "absolute", left: 140, right: 140, top: 250 }}>
        <Panel title=".kiro/steering/weaving-domain.md">
          <Code text={claim} size={58} />
        </Panel>
        <div style={{ marginTop: 26 }}>
          <Label>every statement about real looms carries a label: [sourced], [convention], [decision] or [to verify]</Label>
        </div>
      </div>
    </Stock>
  );
}

/** 100.4 to 104.7: the hooks firing, readable: hook-runs.log and the Run Command Hook panels. */
function Hooks({ excerpts }: { readonly excerpts: Excerpts }) {
  return (
    <Stock>
      <div style={{ position: "absolute", left: 60, top: 36 }}>
        <Label>.kiro/hook-runs.log, live</Label>
        <div style={{ marginTop: 10, width: 1440, height: 525, borderRadius: 8, overflow: "hidden", boxShadow: "0 18px 40px -20px rgb(60 40 20 / 0.55)" }}>
          <OffthreadVideo src={staticFile("media/hooks-log.mp4")} muted style={{ width: "100%", height: "100%" }} />
        </div>
      </div>
      <div style={{ position: "absolute", left: 60, top: 626 }}>
        <Img src={staticFile("media/hooks-panel.png")} style={{ width: 826, height: 241, borderRadius: 8, boxShadow: "0 18px 40px -20px rgb(60 40 20 / 0.55)" }} />
      </div>
      <div style={{ position: "absolute", left: 940, top: 626, width: 900 }}>
        <Label>.kiro/hooks/</Label>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
          {excerpts.hookNames.map((name) => (
            <Chip key={name}>{name}</Chip>
          ))}
        </div>
      </div>
    </Stock>
  );
}

/** 104.7 to 109.0: the log line that explained it, fully visible from the first frame. */
function Trust() {
  return (
    <Stock>
      <div style={{ position: "absolute", left: 80, right: 80, top: 300 }}>
        <Panel title="Kiro log, day one">
          {/* 44 characters at 56 px mono (about 1480 px) keep the key on one line. */}
          <Code text="hooks.v2.executionDisabledUntrustedWorkspace" size={56} highlight={/(executionDisabledUntrustedWorkspace)/} />
        </Panel>
        <div style={{ marginTop: 26 }}>
          <Label>hook execution was off for an untrusted workspace; trusting the folder fixed it</Label>
        </div>
      </div>
    </Stock>
  );
}

/** 109.0 to 116.5: the lattice test that proved the design document wrong. */
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

/** 116.5 to 120.4: the planted bug's shrunk counterexample. */
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

/** 120.4 to 127.6: the mirrored paisley border that lost its figures, and the fixed one. */
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

/** The agents that ran the phase audits (KIRO_JOURNEY.md, Running tally: Custom agents). */
const AUDITORS: readonly string[] = ["weave-auditor", "design-reviewer"];

/** 127.6 to 140.4: custom agents audited through our own MCP server; Kiro driving Chrome through DevTools. */
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
            <Chip key={name} strong={AUDITORS.includes(name)}>
              {name}
            </Chip>
          ))}
        </div>
        <div style={{ marginTop: 16 }}>
          <Label>weave-auditor and design-reviewer audited through jacquard-weave</Label>
        </div>
        <div style={{ height: 26 }} />
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
        <div style={{ height: 26 }} />
        <Label>deployed by Kiro with scripts/deploy-web.sh</Label>
        <div style={{ marginTop: 12 }}>
          <Chip>AWS Amplify Hosting</Chip>
        </div>
      </div>
    </Stock>
  );
}

/** 140.4 to 145.9: the Power and the local Kiro CLI run. */
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
      <Enter delay={60} style={{ position: "absolute", left: 140, right: 140, top: 560 }}>
        <Panel title=".github/workflows/kiro-spec-check.yml">
          <Code text="The CI run is set up but off: Kiro API keys need a paid Kiro plan." size={40} />
        </Panel>
      </Enter>
    </Stock>
  );
}

/** 145.9 to 152.9: what Kiro missed. The cloth before and after the review. */
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
  { at: 86, until: 96.2, render: (excerpts) => <SpecChain excerpts={excerpts} /> },
  { at: 96.2, until: 100.4, render: (excerpts) => <Steering excerpts={excerpts} /> },
  { at: 100.4, until: 104.7, render: (excerpts) => <Hooks excerpts={excerpts} /> },
  // Cut in on "none of them fired until I trusted the workspace" (part 4 starts at 104.8).
  { at: 104.7, until: 109.0, render: () => <Trust /> },
  { at: 109.0, until: 116.5, render: () => <Lattice /> },
  { at: 116.5, until: 120.4, render: (excerpts) => <Planted excerpts={excerpts} /> },
  { at: 120.4, until: 127.6, render: (excerpts) => <Paisley excerpts={excerpts} /> },
  { at: 127.6, until: 140.4, render: (excerpts) => <AgentsMcp excerpts={excerpts} /> },
  { at: 140.4, until: 145.9, render: (excerpts) => <PowerCli excerpts={excerpts} /> },
  { at: 145.9, until: 152.9, render: () => <ClothBeforeAfter /> },
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
