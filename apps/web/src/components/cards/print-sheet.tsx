// The printed card set (studio-experience 12.3): every card, numbered, in lacing order, with the
// untested-format note and the profile summary, and nothing else of the Studio. Rendered into
// <body> only while printing; `@media print` shows only this sheet.
import { createPortal } from "react-dom";
import { CARD_SHEET_NOTE, profileSummary } from "@jacquard/export";
import type { Card, LoomProfile } from "@jacquard/engine";
import { CardFace } from "./card-face";

export interface PrintSheetProps {
  readonly cards: readonly Card[];
  readonly profile: LoomProfile;
  readonly title: string;
  /** Which plan the cards come from, or why there are none. */
  readonly planLine: string;
}

export function PrintSheet({ cards, profile, title, planLine }: PrintSheetProps) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <section className="print-sheet" aria-label="Card set for printing">
      <header className="print-header">
        <h1>{title}</h1>
        <p>{CARD_SHEET_NOTE}</p>
        <p>{profileSummary(profile)}</p>
        <p>{planLine}</p>
        {cards.length === 0 ? (
          <p>No cards to print.</p>
        ) : (
          <p>
            {cards.length} {cards.length === 1 ? "card" : "cards"} in lacing order. Card <i>n</i> weaves pick <i>n</i> − 1.
          </p>
        )}
      </header>
      {/* Repeated at the foot of every printed page. */}
      <p className="print-footer">{CARD_SHEET_NOTE}</p>
      <ol className="print-cards">
        {cards.map((card) => (
          <li key={card.number} className="print-card">
            <CardFace card={card} profile={profile} pitch={9} label={`Card ${card.number}`} />
          </li>
        ))}
      </ol>
    </section>,
    document.body,
  );
}
