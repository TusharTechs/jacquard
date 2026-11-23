// The loom transport (studio-experience 7.1, 7.5): play, pause, scrub, step and speed over the
// Loom_Time t in [0, pickCount]. A step or a scrub to a pick lands on its open shed (the hooks the
// card lifts are up, the shuttle is crossing), the frame that explains the card best, with no
// in-between motion.

export const SPEEDS = [0.5, 1, 2, 4] as const;
export type Speed = (typeof SPEEDS)[number];
/** Picks per second at 1x (Decision log). */
export const PICKS_PER_SECOND = 2;
/** The middle of the shuttle Phase: the shed is open and the card's hooks are fully raised. */
export const OPEN_SHED = 0.5;

export interface TransportState {
  readonly playing: boolean;
  readonly speed: Speed;
  readonly t: number;
  readonly pickCount: number;
}

export type TransportAction =
  | { readonly type: "play" }
  | { readonly type: "pause" }
  | { readonly type: "toggle" }
  | { readonly type: "seek"; readonly t: number }
  | { readonly type: "step"; readonly by: 1 | -1 }
  | { readonly type: "seekPick"; readonly pick: number }
  | { readonly type: "setSpeed"; readonly speed: Speed }
  | { readonly type: "tick"; readonly seconds: number }
  | { readonly type: "reset"; readonly pickCount: number; readonly playing: boolean };

function clamp(t: number, pickCount: number): number {
  if (!Number.isFinite(t)) return 0;
  return Math.min(pickCount, Math.max(0, t));
}

/** Playing starts at pick 0; paused, the loom waits on pick 0 with its shed open (hooks up). */
export function initialTransport(pickCount: number, playing: boolean): TransportState {
  const count = Math.max(0, pickCount);
  const play = playing && count > 0;
  return { playing: play, speed: 1, t: play || count === 0 ? 0 : Math.min(count, OPEN_SHED), pickCount: count };
}

export function transportReducer(state: TransportState, action: TransportAction): TransportState {
  switch (action.type) {
    case "play":
      if (state.pickCount === 0) return state;
      // Playing from the end starts again from pick 0.
      return { ...state, playing: true, t: state.t >= state.pickCount ? 0 : state.t };
    case "pause":
      return state.playing ? { ...state, playing: false } : state;
    case "toggle":
      return transportReducer(state, { type: state.playing ? "pause" : "play" });
    case "seek":
      return { ...state, t: clamp(action.t, state.pickCount) };
    case "step": {
      const pick = Math.min(Math.floor(state.t), Math.max(0, state.pickCount - 1));
      const target = Math.min(Math.max(0, pick + action.by), Math.max(0, state.pickCount - 1));
      return { ...state, playing: false, t: clamp(target + OPEN_SHED, state.pickCount) };
    }
    case "seekPick": {
      const pick = Math.min(Math.max(0, Math.round(action.pick)), Math.max(0, state.pickCount - 1));
      return { ...state, t: clamp(pick + OPEN_SHED, state.pickCount) };
    }
    case "setSpeed":
      return { ...state, speed: action.speed };
    case "tick": {
      if (!state.playing) return state;
      const t = state.t + action.seconds * state.speed * PICKS_PER_SECOND;
      if (t >= state.pickCount) return { ...state, playing: false, t: state.pickCount };
      return { ...state, t };
    }
    case "reset":
      return initialTransport(action.pickCount, action.playing);
  }
}
