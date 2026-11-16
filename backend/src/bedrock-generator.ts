// Generator backed by Amazon Bedrock through the Converse API. See design.md, "Backend".
//
// Credentials and region come only from the standard AWS chain (the Lambda execution role in
// production); nothing is read from the request (2.2). The client is injected so tests use a fake
// with a `send` method and never call AWS.
//
// Error mapping (3.4): provider refusal, throttling, model not ready or not found, and network
// failures become GeneratorUnavailable (503). An abort propagates unchanged (the core has already
// answered 504). Anything else propagates and becomes 500.
import { ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import type { ContentBlock, ConverseCommandOutput } from "@aws-sdk/client-bedrock-runtime";
import type { MotifRequest } from "@jacquard/motif";
import { GeneratorUnavailable } from "./core.js";
import type { Generator } from "./core.js";
import { buildSystemPrompt, buildUserText } from "./prompt.js";

export const DEFAULT_MODEL_ID = "us.anthropic.claude-sonnet-5-5";

/** Longest reply the model may write [decision]: Motif_SVG is at most 65,536 characters. */
const MAX_TOKENS = 8192;

/** The part of BedrockRuntimeClient the generator uses. */
export interface ConverseClient {
  send(command: ConverseCommand, options?: { abortSignal?: AbortSignal }): Promise<ConverseCommandOutput>;
}

export interface BedrockGeneratorOptions {
  readonly client: ConverseClient;
  readonly modelId: string;
}

/** Bedrock error names that mean "the model cannot be used right now" (3.4). */
const UNAVAILABLE_NAMES: ReadonlySet<string> = new Set([
  "AccessDeniedException",
  "ThrottlingException",
  "ServiceUnavailableException",
  "ModelNotReadyException",
  "ResourceNotFoundException",
  // Network-level failures raised by the SDK or Node before any HTTP response.
  "TimeoutError",
  "NetworkingError",
  "RequestTimeout",
]);

/** Node socket error codes that mean the provider is unreachable. */
const NETWORK_CODES: ReadonlySet<string> = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ENOTFOUND",
  "ETIMEDOUT",
  "EAI_AGAIN",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "EPIPE",
]);

function readString(value: unknown, key: string): string | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const field = (value as Record<string, unknown>)[key];
  return typeof field === "string" ? field : undefined;
}

/** True when an SDK error carries `$metadata` but no HTTP status: the request never got a response. */
function isMetadataWithoutStatus(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const metadata = (value as Record<string, unknown>)["$metadata"];
  if (typeof metadata !== "object" || metadata === null) return false;
  return typeof (metadata as Record<string, unknown>)["httpStatusCode"] !== "number";
}

export function isAbortError(value: unknown): boolean {
  return readString(value, "name") === "AbortError";
}

/** True for failures that mean the provider refused, throttled or could not be reached. */
export function isUnavailableError(value: unknown): boolean {
  const name = readString(value, "name");
  if (name !== undefined && UNAVAILABLE_NAMES.has(name)) return true;
  const code = readString(value, "code");
  if (code !== undefined && NETWORK_CODES.has(code)) return true;
  return isMetadataWithoutStatus(value);
}

/**
 * The first ```svg fenced block, else the first `<svg`...`</svg>` span, else the whole text
 * (which parseMotif then rejects, giving 502 MOTIF_SVG_INVALID).
 */
export function extractSvg(reply: string): string {
  const fenced = /```svg[^\S\n]*\n([\s\S]*?)```/i.exec(reply);
  if (fenced?.[1] !== undefined) return fenced[1].trim();
  const start = reply.search(/<svg[\s>/]/i);
  if (start !== -1) {
    const lower = reply.toLowerCase();
    const end = lower.indexOf("</svg>", start);
    if (end !== -1) return reply.slice(start, end + "</svg>".length);
  }
  return reply;
}

function userContent(request: MotifRequest): ContentBlock[] {
  const text: ContentBlock = { text: buildUserText(request) };
  if (request.input.kind === "text") return [text];
  const format = request.input.mediaType === "image/png" ? "png" : "jpeg";
  const bytes = new Uint8Array(Buffer.from(request.input.data, "base64"));
  return [{ image: { format, source: { bytes } } }, text];
}

function replyText(output: ConverseCommandOutput): string {
  const content = output.output?.message?.content ?? [];
  const parts: string[] = [];
  for (const block of content) {
    if (typeof block.text === "string") parts.push(block.text);
  }
  return parts.join("\n");
}

export function createBedrockGenerator(options: BedrockGeneratorOptions): Generator {
  const { client, modelId } = options;
  return {
    source: "model",
    async generate(request: MotifRequest, signal: AbortSignal): Promise<string> {
      const command = new ConverseCommand({
        modelId,
        system: [{ text: buildSystemPrompt(request) }],
        messages: [{ role: "user", content: userContent(request) }],
        inferenceConfig: { maxTokens: MAX_TOKENS },
      });
      let output: ConverseCommandOutput;
      try {
        output = await client.send(command, { abortSignal: signal });
      } catch (caught) {
        if (signal.aborted || isAbortError(caught)) throw caught;
        if (isUnavailableError(caught)) {
          // Fixed message: the provider's text stays in the log, never in a response.
          console.error("[motif] Bedrock call failed", caught);
          throw new GeneratorUnavailable("Bedrock is unavailable.");
        }
        throw caught;
      }
      return extractSvg(replyText(output));
    },
  };
}

/** Model ID from `MOTIF_MODEL_ID`, else the default. */
export function modelIdFromEnv(env: Readonly<Record<string, string | undefined>>): string {
  const value = env["MOTIF_MODEL_ID"]?.trim();
  return value !== undefined && value.length > 0 ? value : DEFAULT_MODEL_ID;
}
