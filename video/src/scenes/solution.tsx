// Scene 2, a working solution (0:21 to 1:26): the Playwright capture of the live site, cut to the
// narration by SOLUTION_EDIT. Real UI only; nothing is drawn over it.
import { Audio, Freeze, OffthreadVideo, Sequence, staticFile } from "remotion";
import { SOLUTION_EDIT } from "../edit";
import type { Segment } from "../edit";
import { Stock } from "../parts";
import { FPS } from "../theme";

const VIDEO = "capture/live.mp4";
const AUDIO = "capture/live-audio.wav";

function Footage({ segment }: { readonly segment: Segment }) {
  const style = { width: "100%", height: "100%" } as const;
  if (segment.to === undefined) {
    return (
      <Freeze frame={0}>
        <OffthreadVideo src={staticFile(VIDEO)} trimBefore={Math.round(segment.from * FPS)} muted style={style} />
      </Freeze>
    );
  }
  const rate = (segment.to - segment.from) / (segment.until - segment.at);
  return <OffthreadVideo src={staticFile(VIDEO)} trimBefore={Math.round(segment.from * FPS)} playbackRate={rate} muted style={style} />;
}

/** `origin` is the Main time where this scene's Sequence starts. */
export function SolutionScene({ origin, appVolume = 0.55 }: { readonly origin: number; readonly appVolume?: number }) {
  return (
    <Stock>
      {SOLUTION_EDIT.map((segment) => (
        <Sequence key={segment.at} from={Math.round((segment.at - origin) * FPS)} durationInFrames={Math.round((segment.until - segment.at) * FPS)}>
          <Footage segment={segment} />
          {segment.audio === true ? <Audio src={staticFile(AUDIO)} trimBefore={Math.round(segment.from * FPS)} volume={appVolume} /> : null}
        </Sequence>
      ))}
    </Stock>
  );
}
