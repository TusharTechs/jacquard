// Shared Dialog on Radix (studio-experience 4.1): focus is trapped while open, Escape and the
// close button close it. Content renders as a `<dialog open>` element, so it is a dialog in the
// DOM as well as in the accessibility tree. When `open` turns false focus returns, at once, to
// the element focused before opening; when that element is gone or disabled it goes to
// `fallbackFocus`, so it never falls to the page body. Radix's own (later) focus return is
// prevented so the two never fight.
import * as RadixDialog from "@radix-ui/react-dialog";
import { useEffect, useRef } from "react";
import type { ReactNode, RefObject } from "react";
import { Button } from "./button";

export interface DialogProps {
  readonly open: boolean;
  readonly title: ReactNode;
  readonly onClose: () => void;
  readonly children: ReactNode;
  readonly closeLabel?: string;
  /** Where focus goes on close when the element focused before opening is gone or disabled. */
  readonly fallbackFocus?: RefObject<HTMLElement | null>;
}

function canTakeFocus(element: HTMLElement | null): element is HTMLElement {
  if (element === null || !element.isConnected || element === element.ownerDocument.body) return false;
  return !(element as HTMLElement & { disabled?: boolean }).disabled;
}

export function Dialog({ open, title, onClose, children, closeLabel = "Close", fallbackFocus }: DialogProps) {
  const returnTo = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);
  const fallbackRef = useRef(fallbackFocus);
  fallbackRef.current = fallbackFocus;

  // Remember the opener during the render that opens the dialog, before Radix moves focus.
  if (open && !wasOpen.current && typeof document !== "undefined") {
    returnTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }

  // A passive effect: by then Radix has released its focus trap for the closing dialog.
  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      return;
    }
    if (!wasOpen.current) return;
    wasOpen.current = false;
    const target = returnTo.current;
    returnTo.current = null;
    if (canTakeFocus(target)) target.focus();
    else fallbackRef.current?.current?.focus();
  }, [open]);

  return (
    <RadixDialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="dialog-overlay" />
        <RadixDialog.Content asChild aria-describedby={undefined} onCloseAutoFocus={(event) => event.preventDefault()}>
          <dialog open className="dialog">
            <div className="dialog-header">
              <RadixDialog.Title className="dialog-title">{title}</RadixDialog.Title>
            </div>
            <div className="dialog-body">{children}</div>
            <div className="dialog-footer">
              <Button onClick={onClose}>
                {closeLabel}
              </Button>
            </div>
          </dialog>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
