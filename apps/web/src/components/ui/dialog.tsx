// Shared Dialog on the native <dialog> element. Opening it remembers the focused element, and
// closing it (button, Escape, backdrop form, or the parent setting `open` false) returns focus
// there. When that element is gone or disabled, focus goes to `fallbackFocus` instead, so it never
// falls to the page body.
import { useEffect, useId, useRef } from "react";
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
  const ref = useRef<HTMLDialogElement | null>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const fallbackRef = useRef(fallbackFocus);
  fallbackRef.current = fallbackFocus;

  /** Returns focus once per opening; a second call (close event after a closed `open`) does nothing. */
  const restoreFocus = (): void => {
    if (returnTo.current === null) return;
    const target = returnTo.current;
    returnTo.current = null;
    if (canTakeFocus(target)) target.focus();
    else fallbackRef.current?.current?.focus();
  };

  useEffect(() => {
    const dialog = ref.current;
    if (dialog === null) return;
    if (open && !dialog.open) {
      returnTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    } else if (!open && dialog.open) {
      if (typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
      // Without a native close event (old browsers, jsdom) focus is returned here.
      restoreFocus();
    }
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog === null) return;
    const handleClose = (): void => {
      restoreFocus();
      onClose();
    };
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [onClose]);

  return (
    <dialog ref={ref} className="dialog" aria-labelledby={titleId}>
      <div className="dialog-header">
        <h2 id={titleId} className="dialog-title">
          {title}
        </h2>
      </div>
      <div className="dialog-body">{children}</div>
      <form method="dialog" className="dialog-footer">
        <Button type="submit" variant="primary">
          {closeLabel}
        </Button>
      </form>
    </dialog>
  );
}
