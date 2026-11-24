// Runs in headless Chromium (bundled by render-audio.ts): renders the score and the effects with
// Tone.Offline and hands each one back as a 16-bit stereo WAV download.
import * as Tone from "tone";
import { scheduleEffect, scheduleScore } from "./score.ts";
import type { EffectName } from "./score.ts";

const SAMPLE_RATE = 48_000;

function wav(buffer: AudioBuffer): Blob {
  const channels = 2;
  const frames = buffer.length;
  const data = new DataView(new ArrayBuffer(44 + frames * channels * 2));
  const text = (offset: number, value: string): void => {
    for (let index = 0; index < value.length; index += 1) data.setUint8(offset + index, value.charCodeAt(index));
  };
  text(0, "RIFF");
  data.setUint32(4, 36 + frames * channels * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  data.setUint32(16, 16, true);
  data.setUint16(20, 1, true);
  data.setUint16(22, channels, true);
  data.setUint32(24, buffer.sampleRate, true);
  data.setUint32(28, buffer.sampleRate * channels * 2, true);
  data.setUint16(32, channels * 2, true);
  data.setUint16(34, 16, true);
  text(36, "data");
  data.setUint32(40, frames * channels * 2, true);
  const left = buffer.getChannelData(0);
  const right = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : left;
  let offset = 44;
  for (let frame = 0; frame < frames; frame += 1) {
    for (const channel of [left, right]) {
      const sample = Math.max(-1, Math.min(1, channel[frame]!));
      data.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([data.buffer], { type: "audio/wav" });
}

function download(name: string, blob: Blob): void {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
}

async function render(name: string, seconds: number, schedule: () => void): Promise<void> {
  const result = await Tone.Offline(() => schedule(), seconds, 2, SAMPLE_RATE);
  const buffer = result.get();
  if (buffer === undefined) throw new Error(`no audio for ${name}`);
  download(name, wav(buffer));
}

declare global {
  interface Window {
    renderAll: (duration: number) => Promise<string[]>;
  }
}

window.renderAll = async (duration: number): Promise<string[]> => {
  const names: string[] = [];
  await render("score.wav", duration, () => scheduleScore(duration));
  names.push("score.wav");
  for (const effect of ["clack", "tick", "whoosh", "thud"] as EffectName[]) {
    await render(`${effect}.wav`, 1.2, () => scheduleEffect(effect));
    names.push(`${effect}.wav`);
  }
  return names;
};
