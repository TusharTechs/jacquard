// Procedural loom sounds (studio-experience Requirement 8), made with tone and no audio files:
// a card clack as the chain advances, a metallic tick as the hooks lift, a soft whoosh as the
// shuttle crosses and a low thud as the reed beats the pick in. Loaded only when the user turns
// sound on (this module is imported dynamically), and quiet.
import type { PhaseName } from "./loom-model";

export interface LoomSound {
  /** Plays the sound of a Phase as it begins; the caller calls this once per Phase per pick. */
  onPhase(phase: PhaseName): void;
  dispose(): void;
}

export async function createLoomSound(): Promise<LoomSound> {
  const Tone = await import("tone");
  await Tone.start();
  const output = new Tone.Volume(-14).toDestination();

  const clack = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.045, sustain: 0, release: 0.02 } });
  const clackFilter = new Tone.Filter({ type: "highpass", frequency: 1800 });
  clack.chain(clackFilter, output);

  const tick = new Tone.MetalSynth({
    envelope: { attack: 0.001, decay: 0.08, release: 0.05 },
    harmonicity: 5.1,
    modulationIndex: 16,
    resonance: 3200,
    octaves: 1.2,
  });
  tick.frequency.value = 260;
  tick.volume.value = -22;
  tick.connect(output);

  const whoosh = new Tone.NoiseSynth({ noise: { type: "pink" }, envelope: { attack: 0.06, decay: 0.18, sustain: 0.2, release: 0.15 } });
  const whooshFilter = new Tone.Filter({ type: "bandpass", frequency: 700, Q: 1.4 });
  whoosh.chain(whooshFilter, output);
  whoosh.volume.value = -10;

  const thud = new Tone.MembraneSynth({ pitchDecay: 0.03, octaves: 3, envelope: { attack: 0.001, decay: 0.22, sustain: 0, release: 0.1 } });
  thud.volume.value = -6;
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
            clack.triggerAttackRelease(0.04, now);
            break;
          case "lift":
            tick.triggerAttackRelease("32n", now);
            break;
          case "shuttle":
            whooshFilter.frequency.cancelScheduledValues(now);
            whooshFilter.frequency.setValueAtTime(500, now);
            whooshFilter.frequency.exponentialRampToValueAtTime(1600, now + 0.25);
            whoosh.triggerAttackRelease(0.25, now);
            break;
          case "beat":
            thud.triggerAttackRelease("C1", "16n", now);
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
