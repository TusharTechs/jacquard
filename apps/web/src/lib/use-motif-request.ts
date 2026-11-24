// The motif request lifecycle for the motif panel (3.6, 3.7): one request at a time, cancel
// aborts it, and a new request aborts the one in progress. Retry is a new generate call built by the
// motif panel from the current prompt or sketch and setup, so it never resends stale settings.
import { useCallback, useEffect, useRef, useState } from "react";
import type { MotifPlan, MotifRequest, MotifResponse } from "@jacquard/motif";
import { requestMotif } from "./motif-client";
import type { MotifFailure } from "./motif-client";

/** Where a placed motif came from: the backend (model or stand-in) or the in-browser motif builder. */
export type MotifSource = MotifResponse["source"] | "builder";

/** A motif ready for the editor. A builder motif carries its plan (motif-builder 3.5). */
export interface PlacedMotif {
  readonly svg: string;
  readonly palette: readonly string[];
  readonly source: MotifSource;
  readonly plan?: MotifPlan;
}

export type MotifRequestState =
  | { readonly status: "idle" }
  | { readonly status: "loading"; readonly inputKind: "text" | "sketch"; readonly startedAt: number }
  | { readonly status: "error"; readonly failure: MotifFailure }
  | { readonly status: "cancelled"; readonly message: string }
  | { readonly status: "success"; readonly source: MotifSource; readonly inputKind: "text" | "sketch" };

/** Applies a response to the design; returns a failure when the motif cannot be used. */
export type ApplyMotif = (response: PlacedMotif, request: MotifRequest) => MotifFailure | null;

export interface MotifRequestControls {
  readonly state: MotifRequestState;
  readonly lastRequest: MotifRequest | null;
  readonly generate: (request: MotifRequest) => void;
  /** Places a motif made in the browser (the motif builder): no request goes out. */
  readonly place: (motif: PlacedMotif, request: MotifRequest) => void;
  readonly cancel: () => void;
  /** Drops any request in progress without a "cancelled" note and goes back to idle. */
  readonly reset: () => void;
}

export function useMotifRequest(apply: ApplyMotif): MotifRequestControls {
  const [state, setState] = useState<MotifRequestState>({ status: "idle" });
  const [lastRequest, setLastRequest] = useState<MotifRequest | null>(null);
  const controller = useRef<AbortController | null>(null);
  const applyRef = useRef(apply);
  useEffect(() => {
    applyRef.current = apply;
  }, [apply]);

  useEffect(() => () => controller.current?.abort(), []);

  const generate = useCallback((request: MotifRequest) => {
    controller.current?.abort();
    const own = new AbortController();
    controller.current = own;
    setLastRequest(request);
    setState({ status: "loading", inputKind: request.input.kind, startedAt: Date.now() });
    void requestMotif(request, { signal: own.signal }).then((result) => {
      if (controller.current !== own) return; // a newer request took over
      controller.current = null;
      if (!result.ok) {
        setState(
          result.failure.kind === "cancelled"
            ? { status: "cancelled", message: result.failure.message }
            : { status: "error", failure: result.failure },
        );
        return;
      }
      const failure = applyRef.current(result.response, request);
      setState(
        failure === null
          ? { status: "success", source: result.response.source, inputKind: request.input.kind }
          : { status: "error", failure },
      );
    });
  }, []);

  const place = useCallback((motif: PlacedMotif, request: MotifRequest) => {
    // A request in flight is replaced, as a new generate would replace it.
    const own = controller.current;
    controller.current = null;
    own?.abort();
    setLastRequest(request);
    const failure = applyRef.current(motif, request);
    setState(failure === null ? { status: "success", source: motif.source, inputKind: request.input.kind } : { status: "error", failure });
  }, []);
  const cancel = useCallback(() => {
    controller.current?.abort();
  }, []);

  const reset = useCallback(() => {
    const own = controller.current;
    // Clear first so the aborted request's result is ignored (it no longer owns the controller).
    controller.current = null;
    own?.abort();
    setLastRequest(null);
    setState({ status: "idle" });
  }, []);
  return { state, lastRequest, generate, place, cancel, reset };
}
