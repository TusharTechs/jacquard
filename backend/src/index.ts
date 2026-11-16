// Public surface of @jacquard/backend. See design.md, "Backend".
export type { Generator, HandlerDeps, HttpResult } from "./core.js";
export { GeneratorUnavailable, handleMotifRequest } from "./core.js";
export { buildSystemPrompt, buildUserText, minimumShapeWidth } from "./prompt.js";
export type { BedrockGeneratorOptions, ConverseClient } from "./bedrock-generator.js";
export {
  createBedrockGenerator,
  DEFAULT_MODEL_ID,
  extractSvg,
  isUnavailableError,
  modelIdFromEnv,
} from "./bedrock-generator.js";
export { createStandInGenerator } from "./stand-in-generator.js";
export type { GeneratorKind } from "./generator-from-env.js";
export { generatorFromEnv } from "./generator-from-env.js";
export type { MotifLambdaHandler } from "./handler.js";
export { createHandler, handler, isMotifRoute, TIMEOUT_MS } from "./handler.js";
