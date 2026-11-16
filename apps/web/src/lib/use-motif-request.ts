// The motif request lifecycle for the motif panel (3.6, 3.7): one request at a time, cancel
// aborts it, retry repeats the last request, and a new request aborts the one in progress.
import { useCallback, useEffect, useRef, useState } from "react";
import type { MotifRequest, MotifResponse } from "@jacquard/motif";
import { requestMotif } from "./motif-client";
import type { MotifFailure } from "./motif-client";

export type MotifRequestState =
  | { readonly status: "idle" }
  | { readonly status: "loading"; readonly inputKind: "text" | "sketch"; readonly startedAt: number }
  | { readonly status: "error"; readonly failure: MotifFailure }
  | { readonly status: "cancelled"; readonly message: string }
  | { readonly status: "success"; readonly source: MotifResponse["source"]; readonly inputKind: "text" | "sketch" };

/** Applies a response to the design; returns a failure when the motif cannot be used. */
export type ApplyMotif = (response: MotifResponse, request: MotifRequest) => MotifFailure | null;

export interface MotifRequestControls {
  readonly state: MotifRequestState;
  readonly lastRequest: MotifRequest | null;
  readonly generate: (request: MotifRequest) => void;
  readonly cancel: () => void;
  readonly retry: () => void;
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

  const cancel = useCallback(() => {
    controller.current?.abort();
  }, []);

  const retry = useCallback(() => {
    if (lastRequest !== null) generate(lastRequest);
  }, [generate, lastRequest]);

  return { state, lastRequest, generate, cancel, retry };
}
