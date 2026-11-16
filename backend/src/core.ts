// Motif request handling, independent of Lambda and HTTP (Requirements 1, 2.3, 3, 13.4).
// See design.md, "Backend".
//
// Order of checks: JSON parse and validateMotifRequest (400); the generator raced against the
// timeout, with its signal aborted on timeout (504); GeneratorUnavailable (503); any other
// exception (500); parseMotif on the output (502); success (200).
//
// Every error message is fixed text or comes from validateMotifRequest / parseMotif. No message
// contains generator error text, request headers, environment values or stack traces (2.3, 3.5).
// Details go to console.error only.
import { parseMotif, validateMotifRequest } from "@jacquard/motif";
import type { MotifErrorBody, MotifRequest, MotifResponse } from "@jacquard/motif";

/** Produces raw Motif_SVG text for a request. */
export interface Generator {
  readonly source: "model" | "standIn";
  generate(request: MotifRequest, signal: AbortSignal): Promise<string>;
}

/** The model provider refused the call, throttled it or could not be reached (3.4). */
export class GeneratorUnavailable extends Error {
  override readonly name = "GeneratorUnavailable";
}

export interface HandlerDeps {
  readonly generator: Generator;
  /** 25000 in production (3.1). */
  readonly timeoutMs: number;
}

export interface HttpResult {
  status: number;
  body: MotifResponse | MotifErrorBody;
}

/** Fixed messages. They never include anything taken from an exception. */
const MESSAGES = {
  bodyNotJson: "Request body must be valid JSON.",
  timeout: "The model did not answer in time. Try again, or draw the motif by hand.",
  unavailable: "The model is not available right now. Try again later, or draw the motif by hand.",
  internal: "Internal error.",
} as const;

const TIMED_OUT: unique symbol = Symbol("timedOut");

type Outcome = { kind: "value"; value: unknown } | { kind: "error"; error: unknown } | { kind: "timeout" };

function error(status: number, body: MotifErrorBody): HttpResult {
  return { status, body };
}

/** Logs a failure without letting a hostile value (throwing getters, toString) escape. */
function logFailure(context: string, detail: unknown): void {
  try {
    console.error(`[motif] ${context}`, detail);
  } catch {
    try {
      console.error(`[motif] ${context} (detail could not be logged)`);
    } catch {
      // Logging must never change the response.
    }
  }
}

async function runGenerator(generator: Generator, request: MotifRequest, timeoutMs: number): Promise<Outcome> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<typeof TIMED_OUT>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve(TIMED_OUT);
    }, timeoutMs);
  });
  // Promise.resolve().then(...) turns a synchronous throw from generate() into a rejection.
  const work = Promise.resolve()
    .then(() => generator.generate(request, controller.signal))
    .then(
      (value): Outcome => ({ kind: "value", value }),
      (caught: unknown): Outcome => ({ kind: "error", error: caught }),
    );
  try {
    const first = await Promise.race([work, timeout]);
    return first === TIMED_OUT ? { kind: "timeout" } : first;
  } finally {
    clearTimeout(timer);
  }
}

/** Handles one raw POST /api/motif body. Never throws. */
export async function handleMotifRequest(rawBody: string | undefined, deps: HandlerDeps): Promise<HttpResult> {
  try {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawBody ?? "");
    } catch {
      return error(400, { code: "REQUEST_INVALID", field: "body", message: MESSAGES.bodyNotJson });
    }
    const validation = validateMotifRequest(parsed);
    if (!validation.ok) return error(400, validation.error);
    const request = validation.value;

    const outcome = await runGenerator(deps.generator, request, deps.timeoutMs);
    if (outcome.kind === "timeout") {
      logFailure(`generator timed out after ${deps.timeoutMs} ms`, undefined);
      return error(504, { code: "MODEL_TIMEOUT", message: MESSAGES.timeout });
    }
    if (outcome.kind === "error") {
      if (outcome.error instanceof GeneratorUnavailable) {
        logFailure("generator unavailable", outcome.error);
        return error(503, { code: "MODEL_UNAVAILABLE", message: MESSAGES.unavailable });
      }
      logFailure("generator failed", outcome.error);
      return error(500, { code: "INTERNAL_ERROR", message: MESSAGES.internal });
    }
    if (typeof outcome.value !== "string") {
      logFailure("generator returned a non-string value", typeof outcome.value);
      return error(500, { code: "INTERNAL_ERROR", message: MESSAGES.internal });
    }
    const svg = outcome.value;

    // 13.4: every generator output is validated before it leaves the backend.
    const motif = parseMotif(svg, request.colourCount);
    if (!motif.ok) {
      const failure = motif.error;
      logFailure(`generator output rejected (${failure.code})`, undefined);
      if (failure.code === "MOTIF_TOO_MANY_COLOURS") {
        return error(502, { code: "MOTIF_TOO_MANY_COLOURS", message: failure.message });
      }
      return error(502, { code: "MOTIF_SVG_INVALID", message: failure.message });
    }
    return {
      status: 200,
      body: { svg, palette: [...motif.value.palette], source: deps.generator.source },
    };
  } catch (caught) {
    logFailure("unexpected failure", caught);
    return error(500, { code: "INTERNAL_ERROR", message: MESSAGES.internal });
  }
}
