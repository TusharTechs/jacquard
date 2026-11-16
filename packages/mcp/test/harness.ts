// Test harness: every server test goes through a real MCP connection (design, Testing Strategy).
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { err } from "@jacquard/engine";
import type { EngineError, Violation } from "@jacquard/engine";
import type { EngineApi } from "../src/engine-api.js";
import { realEngine } from "../src/engine-api.js";
import { createServer } from "../src/server.js";

export interface Connection {
  readonly client: Client;
  call(name: string, args?: unknown): Promise<CallToolResult>;
  close(): Promise<void>;
}

export async function connect(engine: EngineApi = realEngine): Promise<Connection> {
  const server = createServer(engine);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "jacquard-test", version: "0.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return {
    client,
    async call(name, args) {
      const params = args === undefined ? { name } : { name, arguments: args as Record<string, unknown> };
      return (await client.callTool(params)) as CallToolResult;
    },
    async close() {
      await client.close();
      await server.close();
    },
  };
}

/** Opens a connection, runs `body`, and always closes the connection. */
export async function withConnection<T>(
  body: (connection: Connection) => Promise<T>,
  engine: EngineApi = realEngine,
): Promise<T> {
  const connection = await connect(engine);
  try {
    return await body(connection);
  } finally {
    await connection.close();
  }
}

export type EngineFunctionName = Exclude<keyof EngineApi, "profiles">;

export interface SpyCall {
  readonly fn: EngineFunctionName;
  readonly args: readonly unknown[];
}

/** Wraps the real engine and records every call with its argument references. */
export function spyEngine(): { engine: EngineApi; calls: SpyCall[] } {
  const calls: SpyCall[] = [];
  const wrap = <K extends EngineFunctionName>(fn: K): EngineApi[K] => {
    const original = realEngine[fn] as (...args: unknown[]) => unknown;
    return ((...args: unknown[]) => {
      calls.push({ fn, args });
      return original(...args);
    }) as EngineApi[K];
  };
  const engine: EngineApi = {
    profiles: realEngine.profiles,
    defineProfile: wrap("defineProfile"),
    validateProfile: wrap("validateProfile"),
    buildLiftPlan: wrap("buildLiftPlan"),
    checkFloats: wrap("checkFloats"),
    autoFix: wrap("autoFix"),
    buildCards: wrap("buildCards"),
    cardRows: wrap("cardRows"),
    decodeCards: wrap("decodeCards"),
  };
  return { engine, calls };
}

/** The real engine with one function replaced by one that throws `value`. */
export function throwingEngine(fn: EngineFunctionName, value: unknown): EngineApi {
  return {
    ...realEngine,
    [fn]: () => {
      throw value;
    },
  };
}

/** An AUTOFIX_FAILED error built by the test, with the engine's field set. */
export function autofixFailedForTest(
  reason: "stuck" | "iterationLimit",
  maxIterations: number,
  remaining: Violation[],
): EngineError {
  return {
    code: "AUTOFIX_FAILED",
    reason,
    maxIterations,
    remaining,
    message: `Auto-fix failed (${reason}) with ${remaining.length} violations remaining; the iteration bound is ${maxIterations}.`,
  };
}

/** The real engine whose autoFix returns AUTOFIX_FAILED with the given fields. */
export function autofixFailedEngine(
  reason: "stuck" | "iterationLimit",
  maxIterations: number,
): EngineApi {
  return {
    ...realEngine,
    autoFix: (plan, profile) => {
      const remaining = realEngine.checkFloats(plan, profile);
      return err(autofixFailedForTest(reason, maxIterations, remaining.ok ? remaining.value : []));
    },
  };
}

/** Names of the engine operations each tool runs (not counting profile resolution). */
export const TOOL_OPERATIONS: Readonly<Record<string, readonly EngineFunctionName[]>> = {
  list_profiles: [],
  build_lift_plan: ["buildLiftPlan"],
  check_floats: ["checkFloats"],
  auto_fix: ["autoFix"],
  build_cards: ["buildCards", "cardRows"],
  decode_cards: ["decodeCards"],
};
