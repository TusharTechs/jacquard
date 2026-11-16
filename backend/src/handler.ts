// AWS Lambda handler for API Gateway HTTP API events, payload format 2.0. See design.md, "Backend".
//
// Serves only POST on a path ending in /api/motif (a stage prefix is allowed); everything else is
// 404 with a REQUEST_INVALID body. The generator is chosen once, on the first invocation of a cold
// start, from MOTIF_GENERATOR (default `bedrock`).
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { handleMotifRequest } from "./core.js";
import type { HandlerDeps, HttpResult } from "./core.js";
import { generatorFromEnv } from "./generator-from-env.js";

/** 3.1, under API Gateway's 29-second integration limit. */
export const TIMEOUT_MS = 25_000;

const RESPONSE_HEADERS: Readonly<Record<string, string>> = {
  "content-type": "application/json",
  "cache-control": "no-store",
};

export type MotifLambdaHandler = (event: APIGatewayProxyEventV2) => Promise<APIGatewayProxyStructuredResultV2>;

function respond(result: HttpResult): APIGatewayProxyStructuredResultV2 {
  return { statusCode: result.status, headers: { ...RESPONSE_HEADERS }, body: JSON.stringify(result.body) };
}

const NOT_FOUND: HttpResult = {
  status: 404,
  body: { code: "REQUEST_INVALID", field: "path", message: "Only POST /api/motif is served." },
};

const INTERNAL: HttpResult = { status: 500, body: { code: "INTERNAL_ERROR", message: "Internal error." } };

export function isMotifRoute(method: string | undefined, path: string | undefined): boolean {
  return method?.toUpperCase() === "POST" && typeof path === "string" && path.endsWith("/api/motif");
}

function eventBody(event: APIGatewayProxyEventV2): string | undefined {
  if (event.body === undefined) return undefined;
  return event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
}

/** Builds a handler around the given dependencies, or a function that produces them once. */
export function createHandler(deps: HandlerDeps | (() => HandlerDeps)): MotifLambdaHandler {
  let resolved: HandlerDeps | undefined = typeof deps === "function" ? undefined : deps;
  return async (event) => {
    try {
      if (!isMotifRoute(event.requestContext?.http?.method, event.rawPath)) return respond(NOT_FOUND);
      if (resolved === undefined && typeof deps === "function") resolved = deps();
      if (resolved === undefined) return respond(INTERNAL);
      return respond(await handleMotifRequest(eventBody(event), resolved));
    } catch (caught) {
      console.error("[motif] handler failed", caught);
      return respond(INTERNAL);
    }
  };
}

/** The Lambda entry point, configured from the environment. */
export const handler: MotifLambdaHandler = createHandler(() => ({
  generator: generatorFromEnv(process.env, "bedrock"),
  timeoutMs: TIMEOUT_MS,
}));
