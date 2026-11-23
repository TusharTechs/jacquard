// The Step in the URL (studio-experience 2.3): `#/design`, `#/check`, `#/weave`, `#/cards`, so Back,
// Forward and reload return to it. The hash works on static hosting without rewrites. Anything
// else opens Design.
export const STEPS = ["design", "check", "weave", "cards"] as const;
export type Step = (typeof STEPS)[number];

export function isStep(value: string): value is Step {
  return (STEPS as readonly string[]).includes(value);
}

export function parseStep(hash: string): Step {
  const name = hash.replace(/^#/, "").replace(/^\/+/, "").replace(/\/+$/, "");
  return isStep(name) ? name : "design";
}

export function stepHref(step: Step): string {
  return `#/${step}`;
}

/** The Step in the current URL. */
export function currentStep(): Step {
  return typeof window === "undefined" ? "design" : parseStep(window.location.hash);
}

/** Records a Step change as a history entry without a hashchange round trip. */
export function pushStep(step: Step): void {
  if (typeof window === "undefined") return;
  const href = stepHref(step);
  if (window.location.hash === href) return;
  try {
    window.history.pushState(null, "", href);
  } catch {
    window.location.hash = href;
  }
}
