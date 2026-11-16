// Process-level tests (1.2, 1.6, 1.7, 11.1, 13.7): spawn the built entry by its path relative to the
// workspace root and speak JSON-RPC over its stdio. `pretest` builds dist/index.js first (13.8).
import { spawn } from "node:child_process";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = join(here, "..", "..", "..");
const ENTRY = "packages/mcp/dist/index.js";

interface Proc {
  readonly child: ChildProcessWithoutNullStreams;
  stdout(): string;
  send(message: unknown): void;
  sendRaw(line: string): void;
  waitFor(id: number, timeoutMs?: number): Promise<Record<string, unknown>>;
  stop(): Promise<void>;
}

const running: Proc[] = [];

function start(): Proc {
  const child = spawn("node", [ENTRY], { cwd: workspaceRoot, stdio: ["pipe", "pipe", "pipe"] });
  let out = "";
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    out += chunk;
  });
  child.stderr.resume();
  const proc: Proc = {
    child,
    stdout: () => out,
    send(message) {
      child.stdin.write(`${JSON.stringify(message)}\n`);
    },
    sendRaw(line) {
      child.stdin.write(`${line}\n`);
    },
    waitFor(id, timeoutMs = 5000) {
      return new Promise((resolve, reject) => {
        const deadline = setTimeout(() => {
          clearInterval(poll);
          reject(new Error(`no response to id ${id} within ${timeoutMs} ms`));
        }, timeoutMs);
        const poll = setInterval(() => {
          for (const line of out.split("\n")) {
            if (line.trim() === "") continue;
            const message = JSON.parse(line) as Record<string, unknown>;
            if (message["id"] === id) {
              clearTimeout(deadline);
              clearInterval(poll);
              resolve(message);
              return;
            }
          }
        }, 5);
      });
    },
    stop() {
      return new Promise((resolve) => {
        if (child.exitCode !== null) {
          resolve();
          return;
        }
        child.once("exit", () => resolve());
        child.stdin.end();
        child.kill();
      });
    },
  };
  running.push(proc);
  return proc;
}

afterEach(async () => {
  await Promise.all(running.splice(0).map((proc) => proc.stop()));
});

const INIT = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "process-test", version: "0" } },
};
const INITIALIZED = { jsonrpc: "2.0", method: "notifications/initialized" };

const PLAN = {
  pickCount: 2,
  hookCount: 120,
  designWidth: 2,
  repeatAcross: false,
  lifts: [
    [true, false, ...new Array(118).fill(false)],
    [false, true, ...new Array(118).fill(false)],
  ],
};

function callsForEveryTool(firstId: number): unknown[] {
  const calls: [string, Record<string, unknown>][] = [
    ["list_profiles", {}],
    ["build_lift_plan", { design: [[0, 1], [1, 0]], weaves: { "0": { kind: "plain" }, "1": { kind: "plain" } }, profile: "120" }],
    ["check_floats", { plan: PLAN, profile: "120" }],
    ["auto_fix", { plan: PLAN, profile: "120" }],
    ["build_cards", { plan: PLAN, profile: "120" }],
    ["decode_cards", { cardSet: { designWidth: 2, repeatAcross: false, cards: [] }, profile: "120" }],
  ];
  return calls.map(([name, args], i) => ({
    jsonrpc: "2.0",
    id: firstId + i,
    method: "tools/call",
    params: { name, arguments: args },
  }));
}

function everyLineIsJsonRpc(text: string): void {
  expect(text.endsWith("\n")).toBe(true);
  for (const line of text.split("\n").slice(0, -1)) {
    const message = JSON.parse(line) as Record<string, unknown>;
    expect(message["jsonrpc"]).toBe("2.0");
  }
}

async function initialise(proc: Proc): Promise<void> {
  proc.send(INIT);
  await proc.waitFor(1, 5000);
  proc.send(INITIALIZED);
}

describe("built server process", () => {
  it("completes the initialize handshake within 5 seconds (13.7)", async () => {
    const proc = start();
    const started = Date.now();
    proc.send(INIT);
    const response = await proc.waitFor(1, 5000);
    expect(Date.now() - started).toBeLessThan(5000);
    expect(response["result"]).toBeDefined();
  });

  it("writes only complete JSON-RPC messages to stdout (1.2, 1.6)", async () => {
    const proc = start();
    await initialise(proc);
    proc.send({ jsonrpc: "2.0", id: 2, method: "tools/list" });
    const listed = await proc.waitFor(2);
    expect(((listed["result"] as { tools: unknown[] }).tools).length).toBe(6);
    const calls = callsForEveryTool(10);
    for (const call of calls) proc.send(call);
    for (let id = 10; id < 10 + calls.length; id += 1) await proc.waitFor(id);
    everyLineIsJsonRpc(proc.stdout());
  });

  it("keeps running after malformed lines and still answers (1.7)", async () => {
    const proc = start();
    await initialise(proc);
    proc.sendRaw("this is not json");
    proc.sendRaw('{"hello":"world"}');
    proc.send({ jsonrpc: "2.0", id: 3, method: "tools/list" });
    const listed = await proc.waitFor(3);
    expect(listed["result"]).toBeDefined();
    expect(proc.child.exitCode).toBeNull();
    everyLineIsJsonRpc(proc.stdout());
  });

  it("gives byte-identical stdout from two processes for the same requests (11.1)", async () => {
    const run = async (): Promise<string> => {
      const proc = start();
      await initialise(proc);
      const calls = callsForEveryTool(20);
      for (const call of calls) proc.send(call);
      for (let id = 20; id < 20 + calls.length; id += 1) await proc.waitFor(id);
      return proc.stdout();
    };
    const [a, b] = await Promise.all([run(), run()]);
    expect(a.length).toBeGreaterThan(0);
    expect(b).toBe(a);
  });
});
