// The Step rail (studio-experience 2.2, 2.8, 3.2): Design, Check, Weave, Cards as links in a row of
// punched holes on one thread, each with a short status; the current Step has aria-current="step".
// The one primary "Continue" action of the Step sits at the end of the rail, so it is always in
// the same place (and at the thumb on a phone, where the rail is the bottom bar).
import { ArrowRight, Grid3x3, Printer, ScanSearch, Spool } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { MouseEvent, ReactNode } from "react";
import { STEPS, stepHref } from "../../lib/route";
import type { Step } from "../../lib/route";
import { Button } from "../ui/button";

export const STEP_LABELS: Readonly<Record<Step, string>> = { design: "Design", check: "Check", weave: "Weave", cards: "Cards" };
const STEP_ICONS: Readonly<Record<Step, LucideIcon>> = { design: Grid3x3, check: ScanSearch, weave: Spool, cards: Printer };

export interface StepRailProps {
  readonly step: Step;
  readonly status: Readonly<Record<Step, ReactNode>>;
  /** The visible text of each status, for screen readers (the visual one may be a marker). */
  readonly statusText: Readonly<Record<Step, string>>;
  readonly onSelect: (step: Step) => void;
  /** Called when the pointer rests on a Step, so its code can load early. */
  readonly onPrefetch?: (step: Step) => void;
  /** The current Step's primary action, or null on the last Step. */
  readonly next: { readonly label: string; readonly run: () => void; readonly step: Step; readonly primary: boolean } | null;
  /** Lets the app move focus to a rail link when the Step it was in is hidden. */
  readonly linkRef?: (step: Step, node: HTMLAnchorElement | null) => void;
}

export function StepRail({ step, status, statusText, onSelect, onPrefetch, next, linkRef }: StepRailProps) {
  const select = (event: MouseEvent<HTMLAnchorElement>, target: Step): void => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    onSelect(target);
  };
  return (
    <div className="rail-bar">
      <nav className="rail" aria-label="Steps">
        <ol className="rail-list">
          {STEPS.map((item, index) => {
            const Icon = STEP_ICONS[item];
            const current = item === step;
            return (
              <li key={item} className="rail-item">
                <a
                  ref={(node) => linkRef?.(item, node)}
                  className="rail-link"
                  href={stepHref(item)}
                  aria-current={current ? "step" : undefined}
                  aria-keyshortcuts={`Alt+${index + 1}`}
                  onClick={(event) => select(event, item)}
                  onPointerEnter={() => onPrefetch?.(item)}
                  onFocus={() => onPrefetch?.(item)}
                >
                  <span className="rail-hole" aria-hidden="true">
                    <Icon size={18} strokeWidth={2} />
                  </span>
                  <span className="rail-text">
                    <span className="rail-label">{STEP_LABELS[item]}</span>{" "}
                    <span className="rail-status" aria-hidden="true">
                      {status[item]}
                    </span>
                    <span className="sr-only">, {statusText[item]}</span>
                  </span>
                </a>
              </li>
            );
          })}
        </ol>
      </nav>
      {next === null ? null : (
        <Button
          variant={next.primary ? "primary" : "secondary"}
          className="rail-next"
          onClick={next.run}
          onPointerEnter={() => onPrefetch?.(next.step)}
          onFocus={() => onPrefetch?.(next.step)}
        >
          {next.label}
          <ArrowRight aria-hidden="true" size={18} />
        </Button>
      )}
    </div>
  );
}
