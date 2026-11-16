// Chooses the Generator from the environment (design.md, "Backend").
// `MOTIF_GENERATOR` is `bedrock` or `standIn`; the fallback is given by the caller (Lambda uses
// `bedrock`, the dev server `standIn`). Any other value is a configuration error.
import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";
import type { Generator } from "./core.js";
import { createBedrockGenerator, modelIdFromEnv } from "./bedrock-generator.js";
import { createStandInGenerator } from "./stand-in-generator.js";

export type GeneratorKind = "bedrock" | "standIn";

export function generatorFromEnv(
  env: Readonly<Record<string, string | undefined>>,
  fallback: GeneratorKind,
): Generator {
  const raw = env["MOTIF_GENERATOR"]?.trim();
  const kind = raw === undefined || raw.length === 0 ? fallback : raw;
  if (kind === "standIn") return createStandInGenerator();
  if (kind === "bedrock") {
    // Region and credentials come from the standard AWS chain (2.2); nothing is hard-coded.
    return createBedrockGenerator({ client: new BedrockRuntimeClient({}), modelId: modelIdFromEnv(env) });
  }
  throw new Error('MOTIF_GENERATOR must be "bedrock" or "standIn".');
}
