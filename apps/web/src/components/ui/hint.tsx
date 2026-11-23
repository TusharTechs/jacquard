// A short label's help on demand (studio-experience 5.1): a small "i" button with a Radix tooltip.
// It opens on hover and keyboard focus (Radix) and also toggles on click or tap, which Radix
// Tooltip alone ignores, so touch users get the same text. Escape closes it.
import * as Tooltip from "@radix-ui/react-tooltip";
import { Info } from "lucide-react";
import { useRef, useState } from "react";
import type { ReactNode } from "react";

export interface HintProps {
  /** What the hint is about, for the button's name: "About <topic>". */
  readonly topic: string;
  readonly children: ReactNode;
}

export function Hint({ topic, children }: HintProps) {
  const [open, setOpen] = useState(false);
  // Radix closes the tip on pointer down; remember whether it was open so a tap toggles it.
  const openAtPress = useRef(false);
  return (
    <Tooltip.Provider delayDuration={200}>
      <Tooltip.Root open={open} onOpenChange={setOpen}>
        <Tooltip.Trigger asChild>
          <button
            type="button"
            className="hint-button"
            aria-label={`About ${topic}`}
            onPointerDown={() => {
              openAtPress.current = open;
            }}
            onClick={(event) => {
              event.preventDefault();
              const wasOpen = event.detail === 0 ? open : openAtPress.current;
              setOpen(!wasOpen);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape" && open) {
                event.stopPropagation();
                setOpen(false);
              }
            }}
          >
            <Info aria-hidden="true" size={14} strokeWidth={2.25} />
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content className="tip" side="top" align="center" sideOffset={6} collisionPadding={8}>
            {children}
            <Tooltip.Arrow className="tip-arrow" width={10} height={5} />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
