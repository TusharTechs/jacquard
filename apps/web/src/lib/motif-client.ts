// Client for the backend motif route (2.1, 3.6, 3.7). Requests go only to `/api/motif` on this
// origin or on the configured backend base URL; the browser never calls a model provider.
// The static deploy has no backend (deploy-static 1.1): a production build without VITE_API_BASE
// runs the deterministic stand-in in the browser instead (lib/motif-local.ts, a lazy chunk).
//
// Every outcome is a value: a validated response, or a failure with a kind the UI can tell apart
// and a plain message for a designer. Nothing here throws for an expected failure.
import { parseMotif, validateMotifRequest } from "@jacquard/motif";
import type { MotifErrorBody, MotifRequest, MotifResponse } from "@jacquard/motif";

/** Client-side limit, above the backend's 25-second model timeout [decision]. */
export const CLIENT_TIMEOUT_MS = 30_000;

export type MotifFailureKind = "model" | "invalidMotif" | "network" | "offline" | "cancelled" | "request";

export interface MotifFailure {
  readonly kind: MotifFailureKind;
  readonly code?: string;
  readonly message: string;
}

export type MotifClientResult =
  | { readonly ok: true; readonly response: MotifResponse }
  | { readonly ok: false; readonly failure: MotifFailure };

export interface MotifClientOptions {
  readonly signal?: AbortSignal;
  readonly fetchImpl?: typeof fetch;
  readonly baseUrl?: string;
  /** For tests; defaults to CLIENT_TIMEOUT_MS. */
  readonly timeoutMs?: number;
  /** Run the stand-in in the browser instead of calling the backend; defaults to localMotifs(). */
  readonly local?: boolean;
}

/** True in a production build with no backend base URL: the static deploy (deploy-static 1.1). */
export function localMotifs(): boolean {
  const base: unknown = import.meta.env.VITE_API_BASE;
  return import.meta.env.PROD === true && (typeof base !== "string" || base.trim() === "");
}

const loadLocal = () => import("./motif-local");

/** Loads the in-browser stand-in early (on idle), so generating works offline after the first visit. */
export function prefetchLocalMotifs(): void {
  void loadLocal().catch(() => undefined);
}

const KEEP_EDITING = "Your design is unchanged and you can keep editing it by hand.";

const MESSAGES = {
  MODEL_TIMEOUT: `The motif model took too long to answer. Try again in a moment. ${KEEP_EDITING}`,
  MODEL_UNAVAILABLE: `The motif model is not available right now. Try again later. ${KEEP_EDITING}`,
  INTERNAL_ERROR: `Something went wrong on the server while making the motif. Try again. ${KEEP_EDITING}`,
  MOTIF_SVG_INVALID: `The suggested motif could not be turned into a design. Try again, or change the description. ${KEEP_EDITING}`,
  MOTIF_TOO_MANY_COLOURS: `The suggested motif used more colours than your colour count allows. Try again, or raise the colour count. ${KEEP_EDITING}`,
  network: `Could not reach the server. Check your connection and try again. ${KEEP_EDITING}`,
  timeout: `The server did not answer in time. Check your connection and try again. ${KEEP_EDITING}`,
  unexpected: `The server gave an answer the app could not read. Try again in a moment. ${KEEP_EDITING}`,
  offline: `You are offline. Try again when the network is back. ${KEEP_EDITING}`,
  cancelled: "The motif request was cancelled. Your design is unchanged.",
} as const;

/** Plain words for a request the app should not send, by the field the validator names. */
function requestMessage(error: MotifErrorBody): string {
  const field = error.field ?? "";
  if (field === "input.prompt") return "Describe the motif in 1 to 500 characters, then try again.";
  if (field === "input.data" || field === "input.mediaType") return "The sketch must be a PNG or JPEG image of at most 1.5 MB. Choose another file and try again.";
  if (field === "colourCount") return "The colour count must be a whole number from 2 to 8. Change it and try again.";
  if (field === "symmetry") return "Choose a symmetry, then try again.";
  if (field.startsWith("repeat")) return "The repeat must be 8 to 400 ends and 8 to 400 picks. Change it and try again.";
  return "The motif request is incomplete. Check the description and loom setup, then try again.";
}

function fail(kind: MotifFailureKind, message: string, code?: string): MotifClientResult {
  return { ok: false, failure: code === undefined ? { kind, message } : { kind, code, message } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMotifResponse(value: unknown): value is MotifResponse {
  return (
    isRecord(value) &&
    typeof value["svg"] === "string" &&
    Array.isArray(value["palette"]) &&
    value["palette"].every((entry) => typeof entry === "string") &&
    (value["source"] === "model" || value["source"] === "standIn")
  );
}

function mapErrorBody(status: number, body: unknown): MotifClientResult {
  const code = isRecord(body) ? body["code"] : undefined;
  switch (code) {
    case "MODEL_TIMEOUT":
    case "MODEL_UNAVAILABLE":
    case "INTERNAL_ERROR":
      return fail("model", MESSAGES[code], code);
    case "MOTIF_SVG_INVALID":
    case "MOTIF_TOO_MANY_COLOURS":
      return fail("invalidMotif", MESSAGES[code], code);
    case "REQUEST_INVALID": {
      const field = isRecord(body) && typeof body["field"] === "string" ? body["field"] : undefined;
      const message = isRecord(body) && typeof body["message"] === "string" ? body["message"] : "";
      return fail("request", requestMessage(field === undefined ? { code, message } : { code, message, field }), code);
    }
    default:
      // Not a Motif_Error, for example a gateway page: treat it as a network problem.
      return fail("network", `${MESSAGES.unexpected} (HTTP ${status})`);
  }
}

function baseUrlOf(baseUrl: string | undefined): string {
  const env: unknown = import.meta.env.VITE_API_BASE;
  const base = baseUrl ?? (typeof env === "string" ? env : "");
  return base.endsWith("/") ? base.slice(0, -1) : base;
}

const ABORTED = Symbol("aborted");

/** Resolves with the promise, or with ABORTED as soon as the signal aborts. */
function untilAborted<T>(promise: Promise<T>, signal: AbortSignal): Promise<T | typeof ABORTED> {
  if (signal.aborted) return Promise.resolve(ABORTED);
  return new Promise((resolve, reject) => {
    const onAbort = (): void => resolve(ABORTED);
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}

function isOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

/** Sends a motif request to the backend and checks the answer before it reaches the editor. */
export async function requestMotif(request: MotifRequest, options: MotifClientOptions = {}): Promise<MotifClientResult> {
  const validated = validateMotifRequest(request);
  if (!validated.ok) return fail("request", requestMessage(validated.error), validated.error.code);

  const callerSignal = options.signal;
  if (callerSignal?.aborted) return fail("cancelled", MESSAGES.cancelled);
  if (options.local ?? localMotifs()) {
    let local: typeof import("./motif-local");
    try {
      const loaded = await untilAborted(loadLocal(), callerSignal ?? new AbortController().signal);
      if (loaded === ABORTED) return fail("cancelled", MESSAGES.cancelled);
      local = loaded;
    } catch {
      return isOffline() ? fail("offline", MESSAGES.offline) : fail("network", MESSAGES.network);
    }
    const result = local.localStandIn(validated.value);
    if (callerSignal?.aborted) return fail("cancelled", MESSAGES.cancelled);
    if (result.ok) return { ok: true, response: result.response };
    return mapErrorBody(result.error.code === "REQUEST_INVALID" ? 400 : 502, result.error);
  }

  const controller = new AbortController();
  let timedOut = false;
  const onCallerAbort = (): void => controller.abort();
  callerSignal?.addEventListener("abort", onCallerAbort, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeoutMs ?? CLIENT_TIMEOUT_MS);

  const abortedResult = (): MotifClientResult =>
    timedOut && callerSignal?.aborted !== true ? fail("network", MESSAGES.timeout) : fail("cancelled", MESSAGES.cancelled);

  try {
    const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
    let response: Response | typeof ABORTED;
    try {
      response = await untilAborted(
        fetchImpl(`${baseUrlOf(options.baseUrl)}/api/motif`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(validated.value),
          signal: controller.signal,
        }),
        controller.signal,
      );
    } catch {
      if (controller.signal.aborted) return abortedResult();
      return isOffline() ? fail("offline", MESSAGES.offline) : fail("network", MESSAGES.network);
    }
    if (response === ABORTED) return abortedResult();

    let text: string | typeof ABORTED;
    try {
      text = await untilAborted(response.text(), controller.signal);
    } catch {
      if (controller.signal.aborted) return abortedResult();
      return isOffline() ? fail("offline", MESSAGES.offline) : fail("network", MESSAGES.network);
    }
    if (text === ABORTED) return abortedResult();

    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return fail("network", `${MESSAGES.unexpected} (HTTP ${response.status})`);
    }

    if (!response.ok) return mapErrorBody(response.status, body);
    if (!isMotifResponse(body)) return fail("invalidMotif", MESSAGES.MOTIF_SVG_INVALID, "MOTIF_SVG_INVALID");

    // The backend already checked the SVG; check it again before it reaches the editor.
    const parsed = parseMotif(body.svg, validated.value.colourCount);
    if (!parsed.ok) return fail("invalidMotif", MESSAGES[parsed.error.code], parsed.error.code);

    return { ok: true, response: { svg: body.svg, palette: [...body.palette], source: body.source } };
  } finally {
    clearTimeout(timer);
    callerSignal?.removeEventListener("abort", onCallerAbort);
  }
}
