// Step changes (studio-experience 2.6): a view transition where the browser has one and motion is
// allowed, otherwise an instant change. The update runs synchronously inside the transition.
import { flushSync } from "react-dom";
import { prefersReducedMotion } from "./reduced-motion";

type StartViewTransition = (callback: () => void) => unknown;

export function changeView(update: () => void): void {
  const start = (typeof document === "undefined" ? undefined : (document as Document & { startViewTransition?: StartViewTransition }).startViewTransition);
  if (typeof start !== "function" || prefersReducedMotion()) {
    update();
    return;
  }
  try {
    start.call(document, () => flushSync(update));
  } catch {
    update();
  }
}
