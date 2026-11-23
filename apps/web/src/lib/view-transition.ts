// Step changes (studio-experience 2.6): a view transition where the browser has one and motion is
// allowed, otherwise an instant change. Either way the update is flushed synchronously, and
// `after` runs once the new Step is in the DOM (for example to move focus into it).
import { flushSync } from "react-dom";
import { prefersReducedMotion } from "./reduced-motion";

type StartViewTransition = (callback: () => void) => unknown;

export function changeView(update: () => void, after?: () => void): void {
  const run = (): void => {
    flushSync(update);
    after?.();
  };
  const start = typeof document === "undefined" ? undefined : (document as Document & { startViewTransition?: StartViewTransition }).startViewTransition;
  if (typeof start !== "function" || prefersReducedMotion()) {
    run();
    return;
  }
  try {
    start.call(document, run);
  } catch {
    run();
  }
}
