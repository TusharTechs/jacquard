// Compositions (demo-video design, "Remotion"): Main (1920x1080, 30 fps) and Vertical (1080x1920,
// at most 45 s, parts of Main with its own captions).
import { AbsoluteFill, Audio, Composition, Sequence, Series, staticFile } from "remotion";
import { mixOn, useData } from "./data";
import { VERTICAL_DURATION, VERTICAL_PARTS } from "./edit";
import { cuesForTimedParts } from "./cues";
import type { Cue } from "./cues";
import { waitForFonts } from "./fonts";
import { dbToGain, musicGainDb } from "./mix";
import { Stock } from "./parts";
import { DURATION, LIVE_URL, NARRATION_CREDIT, SCENES } from "./script";
import { VOICE_TIMING } from "./voice-timing";
import { Captions } from "./scenes/captions";
import { CloseScene } from "./scenes/close";
import { KiroScene } from "./scenes/kiro";
import { ProblemScene } from "./scenes/problem";
import { SolutionScene } from "./scenes/solution";
import { COLOURS, FONTS, FPS, MAIN, VERTICAL } from "./theme";

waitForFonts();

const CUES: readonly Cue[] = cuesForTimedParts(SCENES, VOICE_TIMING);
const WINDOWS = SCENES.map((scene) => scene.voice);
const scene = (id: string) => SCENES.find((item) => item.id === id)!;

/** Everything in the Main_Cut. `captions` off for the Vertical_Cut, which sets its own. */
function MainContent({ captions = true }: { readonly captions?: boolean }) {
  const data = useData();
  if (data === null) return <Stock />;
  const span = (id: string) => ({ from: Math.round(scene(id).start * FPS), durationInFrames: Math.round((scene(id).end - scene(id).start) * FPS) });
  return (
    <AbsoluteFill>
      <Sequence {...span("problem")}>
        <ProblemScene data={data.problem} />
      </Sequence>
      <Sequence {...span("solution")}>
        <SolutionScene origin={scene("solution").start} />
      </Sequence>
      <Sequence {...span("kiro")}>
        <KiroScene origin={scene("kiro").start} excerpts={data.excerpts} />
      </Sequence>
      <Sequence {...span("close")}>
        <CloseScene />
      </Sequence>
      {captions ? <Captions cues={CUES} /> : null}
      {/* The score, ducked under every narration window (Property 3). */}
      {mixOn("music") ? <Audio src={staticFile("audio/score.wav")} volume={(frame) => dbToGain(musicGainDb(frame / FPS, WINDOWS))} /> : null}
      {/* Tushar's recording, once it exists (demo-video 2.7, 8.3); until then the voice is silent.
          `--props='{"voice":false}'` mutes it for the loudness check's render (8.5). */}
      {data.assets.voice && mixOn("voice") ? <Audio src={staticFile("audio/voice.wav")} /> : null}
    </AbsoluteFill>
  );
}

/** Cues of the Main_Cut inside [from, to), moved to start at `at`. */
function cuesBetween(from: number, to: number, at: number): Cue[] {
  return CUES.filter((cue) => cue.end > from && cue.start < to).map((cue) => ({
    start: Math.max(cue.start, from) - from + at,
    end: Math.min(cue.end, to) - from + at,
    lines: cue.lines,
  }));
}

const VERTICAL_CUES: readonly Cue[] = (() => {
  let at = 0;
  return VERTICAL_PARTS.flatMap((part) => {
    const cues = cuesBetween(part.from, part.to, at);
    at += part.to - part.from;
    return cues;
  });
})();

function VerticalContent() {
  const scale = VERTICAL.width / MAIN.width;
  return (
    <Stock>
      <Series>
        {VERTICAL_PARTS.map((part) => (
          <Series.Sequence key={part.from} durationInFrames={Math.round((part.to - part.from) * FPS)}>
            <div style={{ position: "absolute", left: 0, top: 520, width: MAIN.width, height: MAIN.height, transform: `scale(${scale})`, transformOrigin: "0 0" }}>
              <Sequence from={-Math.round(part.from * FPS)}>
                <MainContent captions={false} />
              </Sequence>
            </div>
          </Series.Sequence>
        ))}
      </Series>
      <div style={{ position: "absolute", left: 70, right: 70, top: 150, fontFamily: '"Fraunces Variable", Georgia, serif', fontSize: 88, fontWeight: 600, letterSpacing: 4 }}>JACQUARD</div>
      <div style={{ position: "absolute", left: 70, right: 70, top: 270, fontFamily: '"Instrument Sans Variable", sans-serif', fontSize: 40, lineHeight: 1.3 }}>
        Punch cards for handlooms, built with Kiro
      </div>
      {/* The last part is the end card: the live URL and the narration credit, large enough to read. */}
      <Sequence from={Math.round((VERTICAL_DURATION - (VERTICAL_PARTS[VERTICAL_PARTS.length - 1]!.to - VERTICAL_PARTS[VERTICAL_PARTS.length - 1]!.from)) * FPS)}>
        <div style={{ position: "absolute", left: 70, right: 70, top: 1190, fontFamily: FONTS.mono }}>
          <div style={{ fontSize: 40, color: COLOURS.walnut }}>{LIVE_URL.replace("https://", "")}</div>
          <div style={{ fontSize: 28, color: COLOURS.inkMuted, marginTop: 18 }}>{NARRATION_CREDIT}</div>
        </div>
      </Sequence>
      {/* 42 px keeps a 42-character caption line on one line inside the box at 1080 wide. */}
      <Captions cues={VERTICAL_CUES} size={42} bottom={330} />
    </Stock>
  );
}

export function Root() {
  return (
    <>
      <Composition id="Main" component={MainContent} durationInFrames={Math.round(DURATION * FPS)} fps={FPS} width={MAIN.width} height={MAIN.height} />
      <Composition id="Vertical" component={VerticalContent} durationInFrames={Math.round(VERTICAL_DURATION * FPS)} fps={FPS} width={VERTICAL.width} height={VERTICAL.height} />
    </>
  );
}
