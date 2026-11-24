// The Vertical_Cut (demo-video 9.9): 1080x1920 for a phone. Each shot is a crop of the Main_Cut or
// of the live-site capture, scaled to the full width (src/vertical.ts has the plan); the end card
// is its own vertical layout. Sound: the voice and the app's sound from the same times as the
// Main_Cut, and the score running on, ducked under the voice.
import type { ComponentType } from "react";
import { AbsoluteFill, Audio, Freeze, OffthreadVideo, Sequence, staticFile } from "remotion";
import { mixOn, useData } from "./data";
import { dbToGain, musicGainDb } from "./mix";
import { Stock } from "./parts";
import { Captions } from "./scenes/captions";
import { LIVE_URL, NARRATION_CREDIT } from "./script";
import { COLOURS, FONTS, FPS, MAIN } from "./theme";
import { CAPTION_BOTTOM, CAPTION_SIZE, SHOTS, VERTICAL_CUES, VERTICAL_WINDOWS, WIDTH, ZONE } from "./vertical";
import type { Crop, Look, Shot } from "./vertical";

const VIDEO = "capture/live.mp4";
const APP_AUDIO = "capture/live-audio.wav";
const frames = (seconds: number): number => Math.round(seconds * FPS);

/** A crop of a 1920x1080 picture, scaled to the width, in the picture zone. */
function Cropped({ crop, children }: { readonly crop: Crop; readonly children: React.ReactNode }) {
  const width = crop.width ?? WIDTH;
  const scale = width / crop.crop.w;
  return (
    <div style={{ position: "absolute", left: ZONE.x + (WIDTH - width) / 2, top: ZONE.y + crop.top, width, height: crop.crop.h * scale, overflow: "hidden", borderRadius: 10, boxShadow: "0 18px 40px -22px rgb(60 40 20 / 0.55)" }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: MAIN.width, height: MAIN.height, transform: `scale(${scale}) translate(${-crop.crop.x}px, ${-crop.crop.y}px)`, transformOrigin: "0 0" }}>{children}</div>
    </div>
  );
}

/** The capture from `from` seconds: playing until `until`, then holding; or holding at `from`. */
function Capture({ from, until, length }: { readonly from: number; readonly until?: number; readonly length: number }) {
  const style = { width: MAIN.width, height: MAIN.height } as const;
  const hold = (at: number) => (
    <Freeze frame={0}>
      <OffthreadVideo src={staticFile(VIDEO)} trimBefore={frames(at)} muted style={style} />
    </Freeze>
  );
  if (until === undefined) return hold(from);
  const plays = Math.min(length, until - from);
  return (
    <>
      <Sequence durationInFrames={Math.max(1, frames(plays))}>
        <OffthreadVideo src={staticFile(VIDEO)} trimBefore={frames(from)} muted style={style} />
      </Sequence>
      {plays < length ? <Sequence from={frames(plays)}>{hold(until)}</Sequence> : null}
    </>
  );
}

function EndCard() {
  return (
    <Stock>
      <div style={{ position: "absolute", left: 80, right: 80, top: 520 }}>
        <div style={{ fontFamily: FONTS.display, fontSize: 150, fontWeight: 600, letterSpacing: 6, color: COLOURS.ink }}>JACQUARD</div>
        <div style={{ fontFamily: FONTS.display, fontSize: 82, fontWeight: 600, color: COLOURS.brassStrong, marginTop: 30 }}>Built with Kiro</div>
        <div style={{ fontFamily: FONTS.mono, fontSize: 40, color: COLOURS.walnut, marginTop: 90 }}>{LIVE_URL.replace("https://", "")}</div>
        <div style={{ fontFamily: FONTS.mono, fontSize: 30, color: COLOURS.inkMuted, marginTop: 40 }}>{NARRATION_CREDIT}</div>
      </div>
    </Stock>
  );
}

function Picture({ shot, look, Main }: { readonly shot: Shot; readonly look: Look; readonly Main: ComponentType<{ captions?: boolean; stems?: boolean }> }) {
  if (look.kind === "end") return <EndCard />;
  if (look.kind === "main") {
    return (
      <>
        {look.crops.map((crop, index) => (
          <Cropped key={index} crop={crop}>
            <Sequence from={-frames(shot.from)}>
              <Main captions={false} stems={false} />
            </Sequence>
          </Cropped>
        ))}
      </>
    );
  }
  const length = shot.to - shot.from;
  return (
    <>
      {look.crops.map((crop, index) => (
        <Cropped key={index} crop={crop}>
          {look.runs.map((item, run) => {
            const start = item.main - shot.from;
            const end = run + 1 < look.runs.length ? look.runs[run + 1]!.main - shot.from : length;
            return (
              <Sequence key={run} from={frames(start)} durationInFrames={Math.max(1, frames(end) - frames(start))}>
                <Capture from={item.run.from} until={item.run.until} length={end - start} />
              </Sequence>
            );
          })}
        </Cropped>
      ))}
      {look.sound === true && mixOn("effects") ? <Audio src={staticFile(APP_AUDIO)} trimBefore={frames(look.runs[0]!.run.from)} volume={0.35} /> : null}
    </>
  );
}

/** `Main` is the Main_Cut's content; `stems={false}` leaves out its score and voice. */
export function VerticalCut({ Main }: { readonly Main: ComponentType<{ captions?: boolean; stems?: boolean }> }) {
  const data = useData();
  const voice = data !== null && data.assets.voice && mixOn("voice");
  return (
    <Stock>
      <div style={{ position: "absolute", left: 80, top: 70, fontFamily: FONTS.display, fontSize: 76, fontWeight: 600, letterSpacing: 4, color: COLOURS.ink }}>JACQUARD</div>
      <div style={{ position: "absolute", left: 80, top: 168, fontFamily: FONTS.sans, fontSize: 34, color: COLOURS.inkMuted }}>Punch cards for handlooms, built with Kiro</div>
      {SHOTS.map((shot) => (
        <Sequence key={`${shot.line}-${shot.from}`} from={frames(shot.at)} durationInFrames={frames(shot.at + shot.to - shot.from) - frames(shot.at)}>
          <AbsoluteFill>
            <Picture shot={shot} look={shot.look} Main={Main} />
            {voice ? <Audio src={staticFile("audio/voice.wav")} trimBefore={frames(shot.from)} /> : null}
          </AbsoluteFill>
        </Sequence>
      ))}
      {mixOn("music") ? <Audio src={staticFile("audio/score.wav")} volume={(frame) => dbToGain(musicGainDb(frame / FPS, VERTICAL_WINDOWS))} /> : null}
      <Captions cues={VERTICAL_CUES} size={CAPTION_SIZE} bottom={CAPTION_BOTTOM} />
    </Stock>
  );
}
