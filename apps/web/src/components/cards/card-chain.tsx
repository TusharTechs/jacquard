// The card chain (studio-experience 12.1, 12.2, 11.4): the engine's cards laced in a chain in
// lacing order, a window of up to 24 around the selected card, and the selected card large with
// its number and punched count. The chain is one listbox: arrows, Home and End move the
// selection, a click or tap picks a card. A card shown large for the first time punches its holes
// row by row (off with reduced motion).
import * as m from "motion/react-m";
import { MotionBoundary } from "../ui/lazy-motion";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import type { Card, LoomProfile } from "@jacquard/engine";
import { cardStrip } from "../../lib/loom-model";
import { useReducedMotion } from "../../lib/reduced-motion";
import { CardFace } from "./card-face";

/** Cards drawn in the chain around the selected one (Decision log: up to 24). */
export const CHAIN_BEFORE = 8;
export const CHAIN_AFTER = 15;

export interface CardChainProps {
  readonly cards: readonly Card[];
  readonly profile: LoomProfile;
  /** False while the Step is hidden: nothing counts as seen, so the first real view punches. */
  readonly visible?: boolean;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

export function CardChain({ cards, profile, visible = true }: CardChainProps) {
  const reduced = useReducedMotion();
  const [selected, setSelected] = useState(0);
  const seen = useRef(new Set<number>());
  const listId = useId();
  const optionRefs = useRef(new Map<number, HTMLLIElement>());
  const count = cards.length;
  useEffect(() => {
    setSelected(0);
    seen.current = new Set();
  }, [cards]);
  const index = Math.min(selected, Math.max(0, count - 1));
  const card = cards[index];
  // The first time a card is shown large it punches its holes; later it just appears.
  // The card being punched, held for the Moment's 800 ms so a re-render does not cut it short.
  const [punching, setPunching] = useState<number | null>(null);
  useEffect(() => {
    if (!visible || card === undefined || seen.current.has(index)) return;
    seen.current.add(index);
    if (reduced) return;
    setPunching(index);
    const timer = setTimeout(() => setPunching((current) => (current === index ? null : current)), 820);
    return () => clearTimeout(timer);
  }, [card, index, visible, reduced]);
  const punch = punching === index;
  // Keep the selected card in the middle of the chain: on selection, and when the chain first gets
  // a width (it is laid out while its Step is hidden). Only the chain scrolls, never the page.
  const listRef = useRef<HTMLOListElement | null>(null);
  const centre = useCallback((): void => {
    const list = listRef.current;
    const option = optionRefs.current.get(index);
    if (list === null || option === undefined || list.clientWidth === 0) return;
    list.scrollLeft = option.offsetLeft - (list.clientWidth - option.offsetWidth) / 2;
  }, [index]);
  useEffect(() => {
    centre();
    const list = listRef.current;
    if (list === null || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => centre());
    observer.observe(list);
    return () => observer.disconnect();
  }, [centre]);
  if (card === undefined) return null;
  const windowed = cardStrip(count, index, CHAIN_BEFORE, CHAIN_AFTER);
  const holes = card.punched.filter(Boolean).length;
  const move = (to: number): void => setSelected(((to % count) + count) % count);
  const onKeyDown = (event: KeyboardEvent<HTMLOListElement>): void => {
    const keys: Record<string, () => void> = {
      ArrowRight: () => move(index + 1),
      ArrowDown: () => move(index + 1),
      ArrowLeft: () => move(index - 1),
      ArrowUp: () => move(index - 1),
      Home: () => move(0),
      End: () => move(count - 1),
      PageDown: () => move(index + 10),
      PageUp: () => move(index - 10),
    };
    const action = keys[event.key];
    if (action !== undefined) {
      event.preventDefault();
      action();
    }
  };
  const optionId = (at: number): string => `${listId}-card-${at}`;
  return (
    <div className="chain">
      <MotionBoundary>
      <m.figure
        key={index}
        className="chain-selected"
        initial={reduced ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
      >
        <CardFace
          card={card}
          profile={profile}
          pitch={10}
          current
          punch={punch}
          label={`Card ${card.number} of ${count}, ${plural(holes, "hole", "holes")} punched`}
        />
        <figcaption className="chain-caption">
          <span className="chain-number mono">Card {card.number}</span>{" "}
          <span className="mono muted">
            of {count} · {plural(holes, "hole", "holes")} punched · weaves pick {card.index}
          </span>
        </figcaption>
      </m.figure>
      </MotionBoundary>
      <ol
        ref={listRef}
        className="chain-list"
        role="listbox"
        tabIndex={0}
        aria-label="Card chain, in lacing order"
        aria-orientation="horizontal"
        aria-activedescendant={optionId(index)}
        onKeyDown={onKeyDown}
      >
        {windowed.map((at, position) => {
          const item = cards[at]!;
          const current = at === index;
          const itemHoles = item.punched.filter(Boolean).length;
          return (
            <li
              key={at}
              id={optionId(at)}
              ref={(node) => {
                if (node === null) optionRefs.current.delete(at);
                else optionRefs.current.set(at, node);
              }}
              role="option"
              aria-selected={current}
              aria-setsize={count}
              aria-posinset={at + 1}
              aria-label={`Card ${item.number}, ${plural(itemHoles, "hole", "holes")} punched, weaves pick ${item.index}`}
              className="chain-card"
              style={{ zIndex: current ? 50 : 40 - Math.abs(position - CHAIN_BEFORE), rotate: `${position % 2 === 0 ? -2 : 2}deg` }}
              onClick={() => {
                move(at);
                listRef.current?.focus({ preventScroll: true });
              }}
            >
              <CardFace card={item} profile={profile} pitch={3} current={current} showNumber={false} />
              <span className="chain-card-number mono">{item.number}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
