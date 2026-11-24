// Procedural loom sounds (studio-experience Requirement 8), made with tone and no audio files:
// a card clack as the chain advances, a metallic tick as the hooks lift, a soft whoosh as the
// shuttle crosses and a low thud as the reed beats the pick in. Loaded only when the user turns
// sound on (this module is imported dynamically), and quiet.
import type { PhaseName } from "./loom-model";
import { LOOM_PATCHES } from "./loom-sound-patches";

export interface LoomSound {
  /** Plays the sound of a Phase as it begins; the caller calls this once per Phase per pick. */
  onPhase(phase: PhaseName): void;
  dispose(): void;
}

export async function createLoomSound(): Promise<LoomSound> {
  const Tone = await import("tone");
  await Tone.start();
  const P = LOOM_PATCHES;
  const output = new Tone.Volume(P.outputVolumeDb).toDestination();
  const clack = new Tone.NoiseSynth(structuredClone(P.clack.synth) as never);
  const clackFilter = new Tone.Filter(structuredClone(P.clack.filter) as never);
  clack.chain(clackFilter, output);
  const tick = new Tone.MetalSynth(structuredClone(P.tick.synth) as never);
  tick.frequency.value = P.tick.frequency;
  tick.volume.value = P.tick.volumeDb;
  tick.connect(output);
  const whoosh = new Tone.NoiseSynth(structuredClone(P.whoosh.synth) as never);
  const whooshFilter = new Tone.Filter(structuredClone(P.whoosh.filter) as never);
  whoosh.chain(whooshFilter, output);
  whoosh.volume.value = P.whoosh.volumeDb;
  const thud = new Tone.MembraneSynth(structuredClone(P.thud.synth) as never);
  thud.volume.value = P.thud.volumeDb;
  thud.connect(output);

  const nodes = [clack, clackFilter, tick, whoosh, whooshFilter, thud, output];
  let disposed = false;

  return {
    onPhase(phase) {
      if (disposed) return;
      const now = Tone.now();
      try {
        switch (phase) {
          case "advance":
            clack.triggerAttackRelease(P.clack.duration, now);
            break;
          case "lift":
            tick.triggerAttackRelease(P.tick.duration, now);
            break;
          case "shuttle":
            whooshFilter.frequency.cancelScheduledValues(now);
            whooshFilter.frequency.setValueAtTime(P.whoosh.sweep.from, now);
            whooshFilter.frequency.exponentialRampToValueAtTime(P.whoosh.sweep.to, now + P.whoosh.sweep.seconds);
            whoosh.triggerAttackRelease(P.whoosh.duration, now);
            break;
          case "beat":
            thud.triggerAttackRelease(P.thud.note, P.thud.duration, now);
            break;
          case "settle":
            break;
        }
      } catch {
        // A sound scheduled too close to the last one is skipped; the loom keeps going.
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const node of nodes) node.dispose();
    },
  };
}
