// The Opening (studio-experience Requirement 10), the Kiroween nod and nothing more: the loom room
// in the dark, one line, the holes of a card chain lighting in turn like a program running, then
// the lights come up into the Studio. Under 4 seconds, shown once per browser, skippable with the
// Skip button, Escape, Enter or a click. The Studio renders underneath at the same time (10.5).
import * as m from "motion/react-m";
import { MotionBoundary } from "./components/ui/lazy-motion";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { parseStep } from "./lib/route";
import { useReducedMotion } from "./lib/reduced-motion";

export const OPENING_LINE = "In 1804, punch cards were the first programs. Handlooms still run on them.";
export const OPENING_KEY = "jacquard.openingSeen";
/** Total time on screen, ms (Decision log: dark 0.4 s, line to 2.6 s, lights up to 3.3 s, fade to 3.6 s). */
export const OPENING_MS = 3600;
export const OPENING_EVENT = "jacquard:opening";

// The Opening's own colours: the dark room, the lit room (the Studio's --room) and the line.
const DARK = "#0f0a07";
const ROOM = "#e9dfcb";
const LINE = "#f1e6d0";
const SECONDS = OPENING_MS / 1000;

function seen(): boolean {
  try {
    return localStorage.getItem(OPENING_KEY) !== null;
  } catch {
    return true;
  }
}

/** First visit only, and only when the URL does not name a Step other than Design (10.3). */
export function shouldShowOpening(): boolean {
  if (typeof window === "undefined" || seen()) return false;
  const hash = window.location.hash;
  return hash === "" || hash === "#" || hash === "#/" || parseStep(hash) === "design";
}

/** The card chain: three cards, their holes lighting in order. */
const HOLES: readonly (readonly [number, number])[] = [
  [0, 0], [2, 0], [5, 0], [1, 1], [3, 1], [6, 1], [0, 2], [4, 2], [5, 2], [2, 3], [3, 3], [6, 3],
];

function LoomOutline({ reduced }: { readonly reduced: boolean }) {
  const cards = [0, 1, 2];
  return (
    <svg className="opening-loom" viewBox="0 0 360 240" aria-hidden="true">
      <g className="opening-frame">
        <path d="M40 230 V60 H320 V230" />
        <path d="M40 150 H320" />
        <rect x="90" y="70" width="180" height="50" rx="3" />
        {Array.from({ length: 24 }, (_, index) => (
          <path key={index} d={`M${100 + index * 7} 78 V112`} />
        ))}
        {Array.from({ length: 24 }, (_, index) => (
          <path key={`c${index}`} d={`M${100 + index * 7} 120 L${70 + index * 9.5} 150`} />
        ))}
      </g>
      {cards.map((card) => (
        <g key={card} transform={`translate(${292 + (card % 2) * 6} ${74 + card * 40}) rotate(${card % 2 === 0 ? -4 : 4})`}>
          <rect className="opening-card" x="0" y="0" width="56" height="30" rx="2" />
          {HOLES.map(([x, y], index) => (
            <m.circle
              key={index}
              className="opening-hole"
              cx={8 + x * 7}
              cy={6 + y * 6}
              r="2"
              initial={reduced ? false : { opacity: 0.15 }}
              animate={reduced ? undefined : { opacity: 1 }}
              transition={{ delay: 0.5 + (card * HOLES.length + index) * 0.045, duration: 0.12 }}
            />
          ))}
        </g>
      ))}
    </svg>
  );
}

export function Opening() {
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(shouldShowOpening);
  const [run, setRun] = useState(0);
  const lineId = useId();
  const skipRef = useRef<HTMLButtonElement | null>(null);

  const close = useCallback((): void => {
    setOpen(false);
    try {
      localStorage.setItem(OPENING_KEY, "1");
    } catch {
      // Private mode: it may show again next time.
    }
    requestAnimationFrame(() => document.getElementById("studio-title")?.focus());
  }, []);

  // "Show the opening again" from the Studio menu.
  useEffect(() => {
    const replay = (): void => {
      setRun((value) => value + 1);
      setOpen(true);
    };
    window.addEventListener(OPENING_EVENT, replay);
    return () => window.removeEventListener(OPENING_EVENT, replay);
  }, []);

  // The clock starts when the page is in view, so a link opened in a background tab still shows it.
  const [visible, setVisible] = useState(() => typeof document === "undefined" || document.visibilityState !== "hidden");
  useEffect(() => {
    const onChange = (): void => setVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);

  useEffect(() => {
    if (!open || !visible) return;
    const timer = setTimeout(close, OPENING_MS);
    return () => clearTimeout(timer);
  }, [open, visible, run, close]);

  useEffect(() => {
    if (!open) return;
    // Captured first and stopped: no Studio shortcut (undo, Step keys) runs under the Opening.
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Tab") return;
      event.stopImmediatePropagation();
      if (event.key === "Escape" || event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        close();
      }
    };
    window.addEventListener("keydown", onKey, true);
    // The Studio underneath is inert while the Opening covers it.
    const studio = document.querySelector(".studio");
    studio?.setAttribute("inert", "");
    skipRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey, true);
      studio?.removeAttribute("inert");
    };
  }, [open, run, close]);

  if (!open) return null;

  const fade = reduced
    ? {}
    : {
        initial: { backgroundColor: DARK, opacity: 1 },
        animate: { backgroundColor: [DARK, DARK, ROOM, ROOM], opacity: [1, 1, 1, 0] },
        transition: { duration: SECONDS, times: [0, 2.6 / SECONDS, 3.3 / SECONDS, 1], ease: "easeInOut" as const },
      };
  const ink = reduced
    ? {}
    : {
        initial: { opacity: 0, y: 8, color: LINE },
        // The line leaves just before the lights come up, so it is never mid-contrast.
        animate: { opacity: [0, 1, 1, 0], y: [8, 0, 0, -4] },
        transition: { duration: 2.9, times: [0, 0.6 / 2.9, 2.5 / 2.9, 1], ease: "easeOut" as const },
      };

  return (
    <MotionBoundary>
    <m.div
      key={run}
      className="opening"
      role="dialog"
      aria-modal="true"
      aria-labelledby={lineId}
      data-reduced={reduced ? "true" : undefined}
      onClick={close}
      {...fade}
    >
      <LoomOutline reduced={reduced} />
      <m.p className="opening-line" id={lineId} {...ink}>
        {OPENING_LINE}
      </m.p>
      <button
        ref={skipRef}
        type="button"
        className="opening-skip"
        onClick={(event) => {
          event.stopPropagation();
          close();
        }}
      >
        Skip
      </button>
    </m.div>
    </MotionBoundary>
  );
}
