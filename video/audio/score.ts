// The demo video's score and sound effects (demo-video 5.1, 5.2), written for Tone.Offline and run
// in headless Chromium by render-audio.ts. Everything here is composed in code: no samples.
//
// The score is a quiet piece in D (pentatonic D E F♯ A B) at 72 bpm, shaped to the four scenes:
// a breathing drone with a sparse pluck for the problem, a gentle pulse for the working solution,
// a move to G for how Kiro built it, and a return to D that fades out for the close.
// The effects (card clack, hook tick, shuttle whoosh, reed thud) use the app's own loom patches.
import * as Tone from "tone";
import { LOOM_PATCHES } from "../../apps/web/src/lib/loom-sound-patches.ts";
import { SCENES } from "../src/script.ts";

export interface SectionPlan {
  readonly start: number;
  readonly end: number;
  readonly root: string;
  readonly figure: readonly string[];
  /** Pluck notes per beat (0.5 = every other beat). */
  readonly density: number;
}

const BPM = 72;
const BEAT = 60 / BPM;

/** Sections follow the scene windows in src/script.ts (Problem, Solution, Kiro, Close). */
const SCENE_AT = (id: string): { start: number; end: number } => {
  const scene = SCENES.find((item) => item.id === id)!;
  return { start: scene.start, end: scene.end };
};
export const SECTIONS: readonly SectionPlan[] = [
  { ...SCENE_AT("problem"), root: "D2", figure: ["A3", "D4", "F#4", "E4"], density: 0.5 },
  { ...SCENE_AT("solution"), root: "D2", figure: ["D4", "F#4", "A4", "B4", "A4", "F#4", "E4", "F#4"], density: 1 },
  { ...SCENE_AT("kiro"), root: "G2", figure: ["B3", "D4", "E4", "G4", "A4", "G4", "E4", "D4"], density: 1 },
  { ...SCENE_AT("close"), root: "D2", figure: ["A3", "D4", "E4", "F#4", "D4"], density: 0.5 },
];

/** Schedules the score on the offline transport. Call inside Tone.Offline. */
export function scheduleScore(duration: number): void {
  const master = new Tone.Volume(-6).toDestination();
  const reverb = new Tone.Reverb({ decay: 4.5, wet: 0.35 }).connect(master);

  // Drone: two soft triangle voices through a slowly breathing low-pass filter.
  const droneFilter = new Tone.Filter({ type: "lowpass", frequency: 420, Q: 0.6 }).connect(reverb);
  const breath = new Tone.LFO({ frequency: 0.07, min: 260, max: 620 }).start(0);
  breath.connect(droneFilter.frequency);
  const drone = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "triangle" },
    envelope: { attack: 3, decay: 0.5, sustain: 0.8, release: 4 },
    volume: -14,
  }).connect(droneFilter);

  // Pluck: a short, warm FM voice.
  const pluck = new Tone.FMSynth({
    harmonicity: 2,
    modulationIndex: 3,
    envelope: { attack: 0.004, decay: 0.6, sustain: 0, release: 0.8 },
    modulationEnvelope: { attack: 0.002, decay: 0.2, sustain: 0, release: 0.2 },
    volume: -12,
  }).connect(reverb);

  for (const section of SECTIONS) {
    const fifth = Tone.Frequency(section.root).transpose(7).toNote();
    const length = section.end - section.start;
    drone.triggerAttackRelease([section.root, fifth], Math.max(1, length - 1), section.start + 0.05, 0.6);
    const step = BEAT / section.density;
    let index = 0;
    for (let t = section.start + BEAT; t < section.end - 0.5; t += step) {
      // Leave a breath every fourth bar so the figure does not run on.
      const bar = Math.floor((t - section.start) / (BEAT * 4));
      if (bar % 4 === 3) continue;
      const note = section.figure[index % section.figure.length]!;
      const velocity = 0.35 + 0.15 * Math.sin(index * 0.9);
      pluck.triggerAttackRelease(note, 0.3, t, velocity);
      index += 1;
    }
  }
  // Fade the last four seconds.
  master.volume.setValueAtTime(-6, duration - 4);
  master.volume.linearRampToValueAtTime(-60, duration - 0.1);
}

export type EffectName = "clack" | "tick" | "whoosh" | "thud";

/** Schedules one effect at time 0, built from the app's loom patches. Call inside Tone.Offline. */
export function scheduleEffect(name: EffectName): void {
  const P = LOOM_PATCHES;
  const output = new Tone.Volume(P.outputVolumeDb).toDestination();
  switch (name) {
    case "clack": {
      const filter = new Tone.Filter(structuredClone(P.clack.filter) as never).connect(output);
      new Tone.NoiseSynth(structuredClone(P.clack.synth) as never).connect(filter).triggerAttackRelease(P.clack.duration, 0.01);
      break;
    }
    case "tick": {
      const tick = new Tone.MetalSynth(structuredClone(P.tick.synth) as never).connect(output);
      tick.frequency.value = P.tick.frequency;
      tick.volume.value = P.tick.volumeDb;
      tick.triggerAttackRelease(P.tick.duration, 0.01);
      break;
    }
    case "whoosh": {
      const filter = new Tone.Filter(structuredClone(P.whoosh.filter) as never).connect(output);
      const whoosh = new Tone.NoiseSynth(structuredClone(P.whoosh.synth) as never).connect(filter);
      whoosh.volume.value = P.whoosh.volumeDb;
      filter.frequency.setValueAtTime(P.whoosh.sweep.from, 0.01);
      filter.frequency.exponentialRampToValueAtTime(P.whoosh.sweep.to, 0.01 + P.whoosh.sweep.seconds);
      whoosh.triggerAttackRelease(P.whoosh.duration, 0.01);
      break;
    }
    case "thud": {
      const thud = new Tone.MembraneSynth(structuredClone(P.thud.synth) as never).connect(output);
      thud.volume.value = P.thud.volumeDb;
      thud.triggerAttackRelease(P.thud.note, P.thud.duration, 0.01);
      break;
    }
  }
}
