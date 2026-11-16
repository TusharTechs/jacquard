// Shared Dialog on the native <dialog> element. Opening it remembers the focused element, and
// closing it (button, Escape or backdrop form) returns focus there.
import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";
import { Button } from "./button";

export interface DialogProps {
  readonly open: boolean;
  readonly title: ReactNode;
  readonly onClose: () => void;
  readonly children: ReactNode;
  readonly closeLabel?: string;
}

export function Dialog({ open, title, onClose, children, closeLabel = "Close" }: DialogProps) {
  const ref = useRef<HTMLDialogElement | null>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const titleId = useId();

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
    }
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog === null) return;
    const handleClose = (): void => {
      returnTo.current?.focus();
      returnTo.current = null;
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
