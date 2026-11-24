// The loom's tone patches as plain data (studio-experience Requirement 8), shared by the app's
// loom sound (loom-sound.ts) and the demo video's sound effects (video/audio, demo-video 5.2).
// Values only: no tone import, so either side can build its own nodes from them.
export const LOOM_PATCHES = {
  outputVolumeDb: -14,
  clack: {
    synth: { noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.045, sustain: 0, release: 0.02 } },
    filter: { type: "highpass", frequency: 1800 },
    duration: 0.04,
  },
  tick: {
    synth: {
      envelope: { attack: 0.001, decay: 0.08, release: 0.05 },
      harmonicity: 5.1,
      modulationIndex: 16,
      resonance: 3200,
      octaves: 1.2,
    },
    frequency: 260,
    volumeDb: -22,
    duration: "32n",
  },
  whoosh: {
    synth: { noise: { type: "pink" }, envelope: { attack: 0.06, decay: 0.18, sustain: 0.2, release: 0.15 } },
    filter: { type: "bandpass", frequency: 700, Q: 1.4 },
    volumeDb: -10,
    sweep: { from: 500, to: 1600, seconds: 0.25 },
    duration: 0.25,
  },
  thud: {
    synth: { pitchDecay: 0.03, octaves: 3, envelope: { attack: 0.001, decay: 0.22, sustain: 0, release: 0.1 } },
    volumeDb: -6,
    note: "C1",
    duration: "16n",
  },
} as const;
