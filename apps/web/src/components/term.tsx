// A weaving term with a short plain-language tooltip (design-language.md: end, pick, float, lift
// plan on first use). The wording follows the glossary in .kiro/steering/weaving-domain.md.
// The term is a button, so it is reachable by keyboard; the tip shows on hover, on focus and on
// tap, and Escape hides it.
import { useId, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";

export type TermName = "end" | "pick" | "float" | "liftPlan";

export const TERM_DEFINITIONS: Readonly<Record<TermName, string>> = {
  end: "End: one warp thread, the lengthwise threads held on the loom. End 0 is the leftmost column of the point paper.",
  pick: "Pick: one pass of the weft across the warp. One pick is one row of point paper. Pick 0 is the first pick woven, drawn at the bottom.",
  float:
    "Float: a run where a warp end or weft thread passes over (or under) several crossing threads without interlacing. Long floats snag and weaken cloth.",
  liftPlan: "Lift plan: for each pick, the set of hooks raised.",
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
      <span role="tooltip" id={tipId} className="term-tip" hidden={!open}>
        {TERM_DEFINITIONS[name]}
      </span>
    </span>
  );
}
