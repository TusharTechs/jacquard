// Toasts on sonner (studio-experience 4.3): a polite live region; a sticky message (one the user
// may act on, such as Undo after a resize) stays until dismissed; every toast has a close button.
// On phones they sit at the top, so they never cover the bottom rail and its Continue action.
import { useEffect, useState } from "react";
import { Toaster as Sonner, toast } from "sonner";

const NARROW = "(max-width: 767px)";

function narrow(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(NARROW).matches;
}

export function Toaster() {
  const [top, setTop] = useState(narrow);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia(NARROW);
    const onChange = (): void => setTop(query.matches);
    query.addEventListener?.("change", onChange);
    return () => query.removeEventListener?.("change", onChange);
  }, []);
  return (
    <Sonner
      position={top ? "top-center" : "bottom-center"}
      closeButton
      visibleToasts={3}
      gap={8}
      offset={16}
      toastOptions={{ className: "toast", duration: 6000 }}
    />
  );
}

export interface NotifyOptions {
  readonly sticky?: boolean;
  /** One action button, for example Undo after a resize. */
  readonly action?: { readonly label: string; readonly run: () => void };
}

export function notify(text: string, options: NotifyOptions = {}): void {
  toast(text, {
    ...(options.sticky === true ? { duration: Infinity } : {}),
    ...(options.action === undefined ? {} : { action: { label: options.action.label, onClick: options.action.run } }),
  });
}
