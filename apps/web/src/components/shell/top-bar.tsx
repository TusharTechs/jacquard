// The Studio's top bar (studio-experience 2.1): the name, one framing line, the loom setup summary
// (a button that opens the setup) and the menu.
import { SlidersHorizontal } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "../ui/button";

// "Handlooms still use them": [sourced, S2 and S3 in .kiro/steering/weaving-domain.md].
export const FRAMING_LINE =
  "Punch cards are dead as a computing medium. Handlooms still use them, and JACQUARD helps designers and card punchers make them.";

export interface TopBarProps {
  readonly setupSummary: string;
  readonly onOpenSetup: () => void;
  readonly menu: ReactNode;
}

function Mark() {
  // A tiny punch card: the brand mark.
  return (
    <svg className="brand-mark" viewBox="0 0 32 24" aria-hidden="true">
      <rect x="1" y="1" width="30" height="22" rx="3" className="brand-card" />
      {[
        [7, 7], [12, 7], [22, 7], [7, 12], [17, 12], [27, 12], [12, 17], [17, 17], [22, 17],
      ].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="1.9" className="brand-hole" />
      ))}
    </svg>
  );
}

export function TopBar({ setupSummary, onOpenSetup, menu }: TopBarProps) {
  return (
    <header className="topbar">
      <div className="brand">
        <Mark />
        <h1 className="app-title" tabIndex={-1} id="studio-title">
          JACQUARD
        </h1>
      </div>
      <p className="app-lede">{FRAMING_LINE}</p>
      <div className="topbar-actions">
        <Button small className="setup-chip" onClick={onOpenSetup} aria-label={`Loom setup: ${setupSummary}`}>
          <SlidersHorizontal aria-hidden="true" size={16} />
          <span className="mono setup-chip-full">{setupSummary}</span>
          <span className="setup-chip-short" aria-hidden="true">
            Setup
          </span>
        </Button>
        {menu}
      </div>
    </header>
  );
}
