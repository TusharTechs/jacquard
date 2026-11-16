// createServer (1.1, 1.5, 8.2 to 8.5, 11.2): the low-level SDK Server with a tools/list handler and
// a tools/call dispatcher. The server keeps no state between calls.
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { checkArguments } from "./arguments.js";
import type { EngineApi } from "./engine-api.js";
import { internalError, toolError } from "./results.js";
import { TOOL_DEFS } from "./tools.js";

export const SERVER_NAME = "jacquard-weave";
export const SERVER_VERSION = "0.0.0";

/** A short description of a thrown value for stderr. Never returned to the client. */
export function describeThrown(value: unknown): string {
  if (value instanceof Error) return value.stack ?? `${value.name}: ${value.message}`;
  try {
    return `Non-error thrown: ${JSON.stringify(value)}`;
  } catch {
    return "Non-error thrown (not serialisable).";
  }
}

export function callTool(engine: EngineApi, name: string, args: unknown): CallToolResult {
  const tool = TOOL_DEFS.find((def) => def.name === name);
  if (tool === undefined) {
    return toolError({ code: "TOOL_UNKNOWN", message: `Unknown tool: ${name}` });
  }
  try {
    const problem = checkArguments(tool.spec, args);
    if (problem) return toolError(problem);
    const record = (args ?? {}) as Readonly<Record<string, unknown>>;
    return tool.handler(record, engine);
  } catch (thrown) {
    console.error(`[jacquard-weave] ${name}: ${describeThrown(thrown)}`);
    return toolError(internalError());
  }
}

export function createServer(engine: EngineApi): Server {
  const server = new Server(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {} } },
  );
  server.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: TOOL_DEFS.map(({ name, description, inputSchema, annotations }) => ({
      name,
      description,
      inputSchema,
      annotations,
    })),
  }));
  server.setRequestHandler(CallToolRequestSchema, (request) =>
    callTool(engine, request.params.name, request.params.arguments),
  );
  return server;
}
