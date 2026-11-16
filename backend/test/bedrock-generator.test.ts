// Bedrock generator examples with a fake client (design.md, "Backend"; Requirements 2.2, 3.4).
// No test calls AWS or the network: the client is a plain object with a `send` method.
import { ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import type { ConverseCommandOutput } from "@aws-sdk/client-bedrock-runtime";
import { standInMotif } from "@jacquard/motif";
import type { MotifRequest } from "@jacquard/motif";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createBedrockGenerator,
  DEFAULT_MODEL_ID,
  extractSvg,
  modelIdFromEnv,
} from "../src/bedrock-generator.js";
import type { ConverseClient } from "../src/bedrock-generator.js";
import { GeneratorUnavailable, handleMotifRequest } from "../src/core.js";

const TEXT_REQUEST: MotifRequest = {
  input: { kind: "text", prompt: "peacock in a lozenge" },
  colourCount: 3,
  symmetry: "mirrorBoth",
  repeat: { ends: 40, picks: 40 },
};
const SKETCH_BYTES = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 1, 2, 255]);
const SKETCH_REQUEST: MotifRequest = {
  input: { kind: "sketch", mediaType: "image/png", data: Buffer.from(SKETCH_BYTES).toString("base64") },
  colourCount: 2,
  symmetry: "none",
  repeat: { ends: 16, picks: 16 },
};
const SVG = standInMotif(TEXT_REQUEST);

function reply(text: string): ConverseCommandOutput {
  return {
    $metadata: { httpStatusCode: 200 },
    output: { message: { role: "assistant", content: [{ text }] } },
    stopReason: "end_turn",
    usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
    metrics: { latencyMs: 1 },
  };
}

interface FakeClient extends ConverseClient {
  commands: ConverseCommand[];
  signals: (AbortSignal | undefined)[];
}

function fakeClient(answer: (command: ConverseCommand) => Promise<ConverseCommandOutput>): FakeClient {
  const client: FakeClient = {
    commands: [],
    signals: [],
    send(command, options) {
      client.commands.push(command);
      client.signals.push(options?.abortSignal);
      return answer(command);
    },
  };
  return client;
}

function serviceError(name: string, status?: number): Error {
  const error = new Error(`${name}: provider secret detail arn:aws:iam::123456789012:role/x`);
  error.name = name;
  Object.assign(error, { $metadata: status === undefined ? {} : { httpStatusCode: status }, $fault: "client" });
  return error;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("extractSvg", () => {
  it("takes the first ```svg fenced block", () => {
    const text = `Here it is:\n\`\`\`svg\n${SVG}\n\`\`\`\nand another\n\`\`\`svg\n<svg viewBox="0 0 1 1"></svg>\n\`\`\``;
    expect(extractSvg(text)).toBe(SVG);
  });

  it("takes the first bare <svg>...</svg> span when there is no fence", () => {
    const text = `Sure. ${SVG} Then <svg viewBox="0 0 1 1"></svg> again.`;
    expect(extractSvg(text)).toBe(SVG);
  });

  it("returns the whole reply when there is no SVG, so parseMotif rejects it", async () => {
    const text = "I cannot draw that.";
    expect(extractSvg(text)).toBe(text);
    const generator = createBedrockGenerator({ client: fakeClient(() => Promise.resolve(reply(text))), modelId: "m" });
    const result = await handleMotifRequest(JSON.stringify(TEXT_REQUEST), { generator, timeoutMs: 1000 });
    expect(result.status).toBe(502);
    expect(result.body).toMatchObject({ code: "MOTIF_SVG_INVALID" });
  });
});

describe("createBedrockGenerator", () => {
  it("sends a Converse command with the model ID, system prompt and text block, and extracts the SVG", async () => {
    const client = fakeClient(() => Promise.resolve(reply("```svg\n" + SVG + "\n```")));
    const generator = createBedrockGenerator({ client, modelId: "test-model" });
    expect(generator.source).toBe("model");
    const svg = await generator.generate(TEXT_REQUEST, new AbortController().signal);
    expect(svg).toBe(SVG);
    expect(client.commands).toHaveLength(1);
    const command = client.commands[0];
    expect(command).toBeInstanceOf(ConverseCommand);
    const input = command?.input;
    expect(input?.modelId).toBe("test-model");
    expect(input?.system?.[0]?.text).toContain("at most 3 distinct fill colours");
    expect(input?.messages).toHaveLength(1);
    expect(input?.messages?.[0]?.role).toBe("user");
    const content = input?.messages?.[0]?.content ?? [];
    expect(content).toHaveLength(1);
    expect(content[0]?.text).toContain("peacock in a lozenge");
  });

  it("sends a sketch as an image block with the decoded bytes", async () => {
    const client = fakeClient(() => Promise.resolve(reply(SVG)));
    const generator = createBedrockGenerator({ client, modelId: "m" });
    await generator.generate(SKETCH_REQUEST, new AbortController().signal);
    const content = client.commands[0]?.input.messages?.[0]?.content ?? [];
    const image = content.find((block) => block.image !== undefined)?.image;
    expect(image?.format).toBe("png");
    expect(Array.from(image?.source?.bytes ?? [])).toEqual(Array.from(SKETCH_BYTES));
    expect(content.some((block) => typeof block.text === "string")).toBe(true);
  });

  it("sends a JPEG sketch with format jpeg", async () => {
    const client = fakeClient(() => Promise.resolve(reply(SVG)));
    const generator = createBedrockGenerator({ client, modelId: "m" });
    const jpeg: MotifRequest = { ...SKETCH_REQUEST, input: { ...SKETCH_REQUEST.input, mediaType: "image/jpeg" } as MotifRequest["input"] };
    await generator.generate(jpeg, new AbortController().signal);
    const content = client.commands[0]?.input.messages?.[0]?.content ?? [];
    expect(content.find((block) => block.image !== undefined)?.image?.format).toBe("jpeg");
  });

  it("passes the abort signal to the client", async () => {
    const client = fakeClient(() => Promise.resolve(reply(SVG)));
    const generator = createBedrockGenerator({ client, modelId: "m" });
    const controller = new AbortController();
    await generator.generate(TEXT_REQUEST, controller.signal);
    expect(client.signals[0]).toBe(controller.signal);
  });

  it("lets an abort error propagate unchanged", async () => {
    const abort = new Error("aborted");
    abort.name = "AbortError";
    const client = fakeClient(() => Promise.reject(abort));
    const generator = createBedrockGenerator({ client, modelId: "m" });
    await expect(generator.generate(TEXT_REQUEST, new AbortController().signal)).rejects.toBe(abort);
  });

  it("times out through the core: 504 and the signal seen by the client is aborted", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const client = fakeClient(() => new Promise<ConverseCommandOutput>(() => undefined));
    const generator = createBedrockGenerator({ client, modelId: "m" });
    const result = await handleMotifRequest(JSON.stringify(TEXT_REQUEST), { generator, timeoutMs: 20 });
    expect(result.status).toBe(504);
    expect(client.signals[0]?.aborted).toBe(true);
  });

  it.each([
    ["AccessDeniedException", 403],
    ["ThrottlingException", 429],
    ["ServiceUnavailableException", 503],
    ["ModelNotReadyException", 429],
    ["ResourceNotFoundException", 404],
    ["TimeoutError", undefined],
    ["NetworkingError", undefined],
  ])("maps %s to GeneratorUnavailable and 503 without leaking the provider message", async (name, status) => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const client = fakeClient(() => Promise.reject(serviceError(name, status)));
    const generator = createBedrockGenerator({ client, modelId: "m" });
    await expect(generator.generate(TEXT_REQUEST, new AbortController().signal)).rejects.toBeInstanceOf(
      GeneratorUnavailable,
    );
    const result = await handleMotifRequest(JSON.stringify(TEXT_REQUEST), { generator, timeoutMs: 1000 });
    expect(result.status).toBe(503);
    expect(result.body).toMatchObject({ code: "MODEL_UNAVAILABLE" });
    expect(JSON.stringify(result.body)).not.toContain("provider secret detail");
    expect(JSON.stringify(result.body)).not.toContain("123456789012");
  });

  it.each(["ECONNREFUSED", "ENOTFOUND", "ECONNRESET", "ETIMEDOUT"])(
    "maps a socket error with code %s to GeneratorUnavailable",
    async (code) => {
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      const error = Object.assign(new Error(`connect ${code} 10.0.0.1:443`), { code });
      const generator = createBedrockGenerator({ client: fakeClient(() => Promise.reject(error)), modelId: "m" });
      await expect(generator.generate(TEXT_REQUEST, new AbortController().signal)).rejects.toBeInstanceOf(
        GeneratorUnavailable,
      );
    },
  );

  it("maps an SDK error that never got an HTTP status to GeneratorUnavailable", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const error = serviceError("UnknownError");
    const generator = createBedrockGenerator({ client: fakeClient(() => Promise.reject(error)), modelId: "m" });
    await expect(generator.generate(TEXT_REQUEST, new AbortController().signal)).rejects.toBeInstanceOf(
      GeneratorUnavailable,
    );
  });

  it.each([
    ["ValidationException", 400],
    ["InternalServerException", 500],
    ["ModelErrorException", 424],
  ])("lets %s propagate, which the core answers with 500 and the fixed message", async (name, status) => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const failure = serviceError(name, status);
    const generator = createBedrockGenerator({ client: fakeClient(() => Promise.reject(failure)), modelId: "m" });
    await expect(generator.generate(TEXT_REQUEST, new AbortController().signal)).rejects.toBe(failure);
    const result = await handleMotifRequest(JSON.stringify(TEXT_REQUEST), { generator, timeoutMs: 1000 });
    expect(result).toEqual({ status: 500, body: { code: "INTERNAL_ERROR", message: "Internal error." } });
  });
});

describe("modelIdFromEnv", () => {
  it("defaults to the design's model ID", () => {
    expect(DEFAULT_MODEL_ID).toBe("us.anthropic.claude-sonnet-5-5");
    expect(modelIdFromEnv({})).toBe(DEFAULT_MODEL_ID);
    expect(modelIdFromEnv({ MOTIF_MODEL_ID: "  " })).toBe(DEFAULT_MODEL_ID);
  });

  it("reads MOTIF_MODEL_ID", () => {
    expect(modelIdFromEnv({ MOTIF_MODEL_ID: "eu.anthropic.other" })).toBe("eu.anthropic.other");
  });
});
