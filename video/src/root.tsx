// Compositions (demo-video design, "Remotion"): Main (1920x1080, 30 fps) and Vertical (1080x1920,
// at most 45 s, src/vertical-cut.tsx).
import { AbsoluteFill, Audio, Composition, Sequence, staticFile } from "remotion";
import { mixOn, useData } from "./data";
import { VERTICAL_SECONDS } from "./vertical";
import { VerticalCut } from "./vertical-cut";
import { cuesForTimedParts } from "./cues";
import type { Cue } from "./cues";
import { waitForFonts } from "./fonts";
import { dbToGain, musicGainDb } from "./mix";
import { Stock } from "./parts";
import { DURATION, SCENES } from "./script";
import { VOICE_TIMING } from "./voice-timing";
import { Captions } from "./scenes/captions";
import { CloseScene } from "./scenes/close";
import { KiroScene } from "./scenes/kiro";
import { ProblemScene } from "./scenes/problem";
import { SolutionScene } from "./scenes/solution";
import { FPS, MAIN, VERTICAL } from "./theme";

waitForFonts();

const CUES: readonly Cue[] = cuesForTimedParts(SCENES, VOICE_TIMING);
const WINDOWS = SCENES.map((scene) => scene.voice);
const scene = (id: string) => SCENES.find((item) => item.id === id)!;

/**
 * Everything in the Main_Cut. The Vertical_Cut shows crops of it with `captions` and `stems` off
 * (it has its own captions, and plays the voice and score itself); scene effects stay.
 */
function MainContent({ captions = true, stems = true }: { readonly captions?: boolean; readonly stems?: boolean }) {
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
      {stems && mixOn("music") ? <Audio src={staticFile("audio/score.wav")} volume={(frame) => dbToGain(musicGainDb(frame / FPS, WINDOWS))} /> : null}
      {/* Tushar's recording, once it exists (demo-video 2.7, 8.3); until then the voice is silent.
          `--props='{"voice":false}'` mutes it for the loudness check's render (8.5). */}
      {stems && data.assets.voice && mixOn("voice") ? <Audio src={staticFile("audio/voice.wav")} /> : null}
    </AbsoluteFill>
  );
}

function VerticalContent() {
  return <VerticalCut Main={MainContent} />;
}
export function Root() {
  return (
    <>
      <Composition id="Main" component={MainContent} durationInFrames={Math.round(DURATION * FPS)} fps={FPS} width={MAIN.width} height={MAIN.height} />
      <Composition id="Vertical" component={VerticalContent} durationInFrames={Math.round(VERTICAL_SECONDS * FPS)} fps={FPS} width={VERTICAL.width} height={VERTICAL.height} />
    </>
  );
}
