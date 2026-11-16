// Shared Toast: a polite live region that is always in the page, so screen readers hear each new
// message. A message disappears after `timeoutMs` or when dismissed.
import { useEffect } from "react";
import { Button } from "./button";

export interface ToastMessage {
  /** Changes for every new message, so the same text twice is still announced. */
  readonly id: number;
  readonly text: string;
}

export interface ToastProps {
  readonly message: ToastMessage | null;
  readonly onDismiss: () => void;
  readonly timeoutMs?: number;
}

export function Toast({ message, onDismiss, timeoutMs = 6000 }: ToastProps) {
  useEffect(() => {
    if (message === null) return;
    const timer = setTimeout(onDismiss, timeoutMs);
    return () => clearTimeout(timer);
  }, [message, onDismiss, timeoutMs]);

  return (
    <div className="toast-region" role="status" aria-live="polite" aria-atomic="true">
      {message === null ? null : (
        <div className="toast" key={message.id}>
          <span className="toast-text">{message.text}</span>
          <Button variant="quiet" small onClick={onDismiss} aria-label="Dismiss message">
            Dismiss
          </Button>
        </div>
      )}
    </div>
  );
}
