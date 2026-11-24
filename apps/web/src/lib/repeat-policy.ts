// When "repeat across all hooks" is on (studio-experience 17.1): it follows the design until the
// user chooses. A design that arrives (blank grid, motif, gallery example) turns it on exactly when
// its width divides the hook count; while the user has not chosen, a new profile or width applies
// the same rule; once the user toggles it, that choice stays until the next design arrives.
// Display policy only: the engine decides what repeat across means.

export interface RepeatPolicy {
  readonly repeatAcross: boolean;
  /** True once the user has toggled the switch since the last design arrived. */
  readonly chosen: boolean;
}

export type RepeatEvent =
  | { readonly type: "arrive"; readonly ends: number; readonly hookCount: number }
  | { readonly type: "reshape"; readonly ends: number; readonly hookCount: number }
  | { readonly type: "choose"; readonly repeatAcross: boolean };

/** True when a design `ends` wide fills `hookCount` hooks a whole number of times. */
export function repeatFits(ends: number, hookCount: number): boolean {
  return Number.isInteger(ends) && Number.isInteger(hookCount) && ends > 0 && hookCount > 0 && hookCount % ends === 0;
}

export function repeatPolicy(state: RepeatPolicy, event: RepeatEvent): RepeatPolicy {
  switch (event.type) {
    case "arrive":
      return { repeatAcross: repeatFits(event.ends, event.hookCount), chosen: false };
    case "reshape":
      return state.chosen ? state : { repeatAcross: repeatFits(event.ends, event.hookCount), chosen: false };
    case "choose":
      return { repeatAcross: event.repeatAcross, chosen: true };
  }
}
