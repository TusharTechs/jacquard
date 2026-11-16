// A weaving term with a short plain-language tooltip (design-language.md: end, pick, float, lift
// plan on first use). The wording follows the glossary in .kiro/steering/weaving-domain.md.
// The term is a button, so it is reachable by keyboard; the tip shows on hover, on focus and on
// tap, and Escape hides it.
import { useId, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";

export type TermName = "end" | "pick" | "float" | "liftPlan" | "shaft";

export const TERM_DEFINITIONS: Readonly<Record<TermName, string>> = {
  end: "End: one warp thread, the lengthwise threads held on the loom. End 0 is the leftmost column of the point paper.",
  pick: "Pick: one pass of the weft across the warp. One pick is one row of point paper. Pick 0 is the first pick woven, drawn at the bottom.",
  float:
    "Float: a run where a warp end or weft thread passes over (or under) several crossing threads without interlacing. Long floats snag and weaken cloth.",
  liftPlan: "Lift plan: for each pick, the set of hooks raised.",
  shaft: "Shaft: on a shaft loom, a frame that lifts every warp end threaded on it. In this WIF each hook gets its own shaft.",
};

export interface TermProps {
  readonly name: TermName;
  readonly children: ReactNode;
}

export function Term({ name, children }: TermProps) {
  const tipId = useId();
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const open = !dismissed && (hover || focus || pinned);
  // Keep the tip inside the viewport: shift it left when it would overflow the right edge.
  const tipRef = useRef<HTMLSpanElement | null>(null);
  const [shift, setShift] = useState(0);
  useLayoutEffect(() => {
    const tip = tipRef.current;
    if (!open || tip === null || typeof window === "undefined") {
      setShift(0);
      return;
    }
    const margin = 8;
    const box = tip.getBoundingClientRect();
    const left = box.left - shift;
    const right = left + box.width;
    const limit = document.documentElement.clientWidth || window.innerWidth;
    const next = right > limit - margin ? Math.max(margin - left, limit - margin - right) : left < margin ? margin - left : 0;
    if (next !== shift) setShift(next);
  }, [open]);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (event.key === "Escape" && open) {
      event.stopPropagation();
      setDismissed(true);
      setPinned(false);
    }
  };

  return (
    <span className="term" onMouseEnter={() => setHover(true)} onMouseLeave={() => { setHover(false); setDismissed(false); }}>
      <button
        type="button"
        className="term-button"
        aria-describedby={tipId}
        aria-expanded={open}
        onFocus={() => setFocus(true)}
        onBlur={() => {
          setFocus(false);
          setPinned(false);
          setDismissed(false);
        }}
        onClick={() => {
          setDismissed(false);
          setPinned((value) => !value);
        }}
        onKeyDown={onKeyDown}
      >
        {children}
      </button>
      <span
        role="tooltip"
        id={tipId}
        ref={tipRef}
        className="term-tip"
        hidden={!open}
        style={shift === 0 ? undefined : { transform: `translateX(${shift}px)` }}
      >
        {TERM_DEFINITIONS[name]}
      </span>
    </span>
  );
}
