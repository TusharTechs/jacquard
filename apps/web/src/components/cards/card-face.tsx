// One punch card drawn flat (studio-experience 6.4, 7.2, 12.1): card stock with rounded corners,
// two lacing holes at each end, the card number at the numbered end, and the hole grid from the
// engine's cardRows: punched holes show the background through, unpunched positions are faint
// rings. The card lies with its long side across: card row r is column r (row 0 nearest the
// numbered end, [to verify]), slot 0 at the top [sourced, S1].
import { cardRows } from "@jacquard/engine";
import type { Card, LoomProfile } from "@jacquard/engine";
import { useMemo } from "react";
import type { ReactElement } from "react";

export interface CardFaceProps {
  readonly card: Card;
  readonly profile: LoomProfile;
  /** Hole pitch in px. */
  readonly pitch?: number;
  readonly current?: boolean;
  readonly className?: string;
  /** Accessible label; without one the card is decorative (aria-hidden). */
  readonly label?: string;
  /** Holes punch row by row when true (a Moment; off with reduced motion). */
  readonly punch?: boolean;
  /** The printed card number; off for thumbnails too small to read it. */
  readonly showNumber?: boolean;
}

/** Margins in hole pitches: the numbered end (left) and the lacing end (right), top and bottom. */
const END_LEFT = 2.6;
const END_RIGHT = 1.6;
const EDGE = 0.7;

export function cardSize(rowCount: number, slots: number, pitch: number): { readonly width: number; readonly height: number } {
  return { width: (rowCount + END_LEFT + END_RIGHT) * pitch, height: (slots + EDGE * 2) * pitch };
}

export function CardFace({ card, profile, pitch = 8, current = false, className, label, punch = false, showNumber = true }: CardFaceProps) {
  const rows = useMemo(() => cardRows(card, profile), [card, profile]);
  const slots = profile.hooksPerCardRow;
  const { width, height } = cardSize(rows.length, slots, pitch);
  const radius = pitch * 0.32;
  const punched = card.punched.filter(Boolean).length;
  const holes: ReactElement[] = [];
  rows.forEach((row, rowIndex) => {
    row.forEach((state, slot) => {
      if (state === null) return;
      const cx = (END_LEFT + rowIndex + 0.5) * pitch;
      const cy = (EDGE + slot + 0.5) * pitch;
      holes.push(
        <circle
          key={`${rowIndex}-${slot}`}
          cx={cx}
          cy={cy}
          r={state ? radius : radius * 0.55}
          className={state ? "card-hole" : "card-blank"}
          style={punch && state ? { animationDelay: `${Math.round((rowIndex / Math.max(1, rows.length)) * 700)}ms` } : undefined}
        />,
      );
    });
  });
  const lace = pitch * 0.42;
  return (
    <svg
      className={["card-face", current ? "card-face-current" : "", punch ? "card-face-punch" : "", className ?? ""].filter(Boolean).join(" ")}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role={label === undefined ? undefined : "img"}
      aria-label={label}
      aria-hidden={label === undefined ? true : undefined}
      data-card={card.number}
      data-punched={punched}
    >
      <rect x={0.5} y={0.5} width={width - 1} height={height - 1} rx={pitch * 0.6} className="card-stock" />
      {/* Lacing holes: two at each end. */}
      {[height * 0.28, height * 0.72].map((cy) => (
        <g key={cy}>
          <circle cx={pitch * 0.75} cy={cy} r={lace} className="card-lace" />
          <circle cx={width - pitch * 0.75} cy={cy} r={lace} className="card-lace" />
        </g>
      ))}
      {showNumber ? <text x={pitch * 1.75} y={height / 2} className="card-number" fontSize={Math.max(7, pitch * 1.05)} textAnchor="middle" dominantBaseline="central" transform={`rotate(-90 ${pitch * 1.75} ${height / 2})`}>
        {card.number}
      </text> : null}
      {holes}
    </svg>
  );
}
