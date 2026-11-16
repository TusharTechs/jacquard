// Shared Tabs with a roving tabindex: only the selected tab is in the tab order; Left and Right
// arrows (wrapping), Home and End move between tabs and select them. All panels stay mounted so
// their form state survives a tab change; the hidden ones are hidden.
import { useId, useRef } from "react";
import type { KeyboardEvent, ReactNode } from "react";

export interface TabItem {
  readonly id: string;
  readonly label: ReactNode;
  readonly panel: ReactNode;
}

export interface TabsProps {
  readonly label: string;
  readonly items: readonly TabItem[];
  readonly selected: string;
  readonly onSelect: (id: string) => void;
}

export function Tabs({ label, items, selected, onSelect }: TabsProps) {
  const base = useId();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedIndex = Math.max(0, items.findIndex((item) => item.id === selected));

  const move = (index: number): void => {
    const count = items.length;
    const next = ((index % count) + count) % count;
    const item = items[next];
    if (item === undefined) return;
    onSelect(item.id);
    tabRefs.current[next]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number): void => {
    switch (event.key) {
      case "ArrowRight":
        event.preventDefault();
        move(index + 1);
        break;
      case "ArrowLeft":
        event.preventDefault();
        move(index - 1);
        break;
      case "Home":
        event.preventDefault();
        move(0);
        break;
      case "End":
        event.preventDefault();
        move(items.length - 1);
        break;
      default:
        break;
    }
  };

  return (
    <div className="tabs">
      <div className="tab-list" role="tablist" aria-label={label}>
        {items.map((item, index) => {
          const isSelected = index === selectedIndex;
          return (
            <button
              key={item.id}
              ref={(node) => {
                tabRefs.current[index] = node;
              }}
              type="button"
              role="tab"
              id={`${base}-tab-${item.id}`}
              aria-selected={isSelected}
              aria-controls={`${base}-panel-${item.id}`}
              tabIndex={isSelected ? 0 : -1}
              className="tab"
              onClick={() => onSelect(item.id)}
              onKeyDown={(event) => onKeyDown(event, index)}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {items.map((item, index) => (
        <div
          key={item.id}
          role="tabpanel"
          id={`${base}-panel-${item.id}`}
          aria-labelledby={`${base}-tab-${item.id}`}
          hidden={index !== selectedIndex}
          className="tab-panel"
        >
          {item.panel}
        </div>
      ))}
    </div>
  );
}
