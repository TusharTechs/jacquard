// Compositions (demo-video design, "Remotion"): Main (1920x1080, 30 fps) and Vertical (1080x1920,
// at most 45 s, parts of Main with its own captions).
import { AbsoluteFill, Audio, Composition, Sequence, Series, getInputProps, staticFile } from "remotion";
import { useData } from "./data";
import { VERTICAL_DURATION, VERTICAL_PARTS } from "./edit";
import { cuesForParts } from "./cues";
import type { Cue } from "./cues";
import { waitForFonts } from "./fonts";
import { dbToGain, musicGainDb } from "./mix";
import { Stock } from "./parts";
import { DURATION, SCENES } from "./script";
import { Captions } from "./scenes/captions";
import { CloseScene } from "./scenes/close";
import { KiroScene } from "./scenes/kiro";
import { ProblemScene } from "./scenes/problem";
import { SolutionScene } from "./scenes/solution";
import { FPS, MAIN, VERTICAL } from "./theme";

waitForFonts();

const CUES: readonly Cue[] = cuesForParts(SCENES);
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
      <Audio src={staticFile("audio/score.wav")} volume={(frame) => dbToGain(musicGainDb(frame / FPS, WINDOWS))} />
      {/* Tushar's recording, once it exists (demo-video 2.7, 8.3); until then the voice is silent.
          `--props='{"voice":false}'` mutes it for the loudness check's render (8.5). */}
      {data.assets.voice && getInputProps()["voice"] !== false ? <Audio src={staticFile("audio/voice.wav")} /> : null}
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
      <Captions cues={VERTICAL_CUES} size={50} bottom={330} />
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
