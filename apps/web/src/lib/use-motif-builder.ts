// Loads the motif builder chunk (motif-builder 3.1) when the static build needs it: on idle, or at
// once when asked (first focus of the description, or Generate before it arrived).
import { useCallback, useEffect, useState } from "react";

export type MotifBuilderModule = typeof import("./motif-builder");

let loading: Promise<MotifBuilderModule> | null = null;
let loaded: MotifBuilderModule | null = null;

function loadBuilder(): Promise<MotifBuilderModule> {
  if (loading === null) {
    loading = import("./motif-builder").then((module) => {
      loaded = module;
      return module;
    });
    // A failed load (offline on the first visit) may be retried later.
    loading.catch(() => {
      loading = null;
    });
  }
  return loading;
}

/** Loads the chunk early, so describing and generating work offline after the first visit. */
export function prefetchMotifBuilder(): void {
  void loadBuilder().catch(() => undefined);
}

export interface MotifBuilderHandle {
  /** The module once loaded, else null. */
  readonly builder: MotifBuilderModule | null;
  /** Loads now; resolves to null when the chunk cannot be loaded. */
  readonly load: () => Promise<MotifBuilderModule | null>;
}

export function useMotifBuilder(enabled: boolean): MotifBuilderHandle {
  const [builder, setBuilder] = useState<MotifBuilderModule | null>(() => (enabled ? loaded : null));
  const load = useCallback(async (): Promise<MotifBuilderModule | null> => {
    if (!enabled) return null;
    try {
      const module = await loadBuilder();
      setBuilder(module);
      return module;
    } catch {
      return null;
    }
  }, [enabled]);
  useEffect(() => {
    if (!enabled || builder !== null) return;
    let cancelled = false;
    const run = (): void => {
      loadBuilder().then(
        (module) => {
          if (!cancelled) setBuilder(module);
        },
        () => undefined,
      );
    };
    // On idle, so the first screen is not held up by it.
    const host = globalThis as { requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number; cancelIdleCallback?: (handle: number) => void };
    if (typeof host.requestIdleCallback === "function") {
      const handle = host.requestIdleCallback(run, { timeout: 1500 });
      return () => {
        cancelled = true;
        host.cancelIdleCallback?.(handle);
      };
    }
    const timer = setTimeout(run, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [enabled, builder]);
  return { builder, load };
}
