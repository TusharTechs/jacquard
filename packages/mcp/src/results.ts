// Result envelope (8.1 to 8.4, 9.6, 11.4). Every tool returns one text item holding Canonical_JSON
// and the parse of that same text as structuredContent, so text and structure always agree.
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { canonicalJson } from "./canonical-json.js";

export { argumentError } from "./arguments.js";
export type { ArgumentError } from "./arguments.js";

export interface InternalError {
  readonly code: "INTERNAL_ERROR";
  readonly message: "Internal error.";
}

function envelope(value: object): CallToolResult {
  const text = canonicalJson(value);
  return {
    content: [{ type: "text", text }],
    structuredContent: JSON.parse(text) as Record<string, unknown>,
  };
}

/** A successful tool result. No `isError` field is set. */
export function toolResult(value: object): CallToolResult {
  return envelope(value);
}

/** A Tool_Error: the error object with every field unchanged, flagged `isError: true`. */
export function toolError(error: { readonly code: string; readonly message: string }): CallToolResult {
  return { ...envelope(error), isError: true };
}

/** The fixed INTERNAL_ERROR body: no stack, no path, no thrown text (8.3, 8.4). */
export function internalError(): InternalError {
  return { code: "INTERNAL_ERROR", message: "Internal error." };
}
