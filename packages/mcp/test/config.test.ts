// Configuration scan (14.1 to 14.3, 14.5, 14.7, 14.8). Fails with the offending file and value.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = join(here, "..", "..", "..");
const MCP_JSON = ".kiro/settings/mcp.json";
const AUDITOR = ".kiro/agents/weave-auditor.json";
const REVIEWER = ".kiro/agents/design-reviewer.json";
const WEAVE_TOOLS = [
  "list_profiles",
  "build_lift_plan",
  "check_floats",
  "auto_fix",
  "build_cards",
  "decode_cards",
];

function read(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(workspaceRoot, path), "utf8")) as Record<string, unknown>;
}

/** Every string anywhere in a JSON value. */
function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value !== null && typeof value === "object") {
    return Object.entries(value).flatMap(([key, inner]) => [key, ...strings(inner)]);
  }
  return [];
}

const FORBIDDEN_VALUE = [
  { why: "absolute path", test: (s: string) => s.startsWith("/") || /^[A-Za-z]:[\\/]/.test(s) },
  { why: "home directory", test: (s: string) => s.includes("~") || s.includes("/Users/") },
  { why: "key or token", test: (s: string) => /(api[_-]?key|token|secret|password|AKIA[0-9A-Z]{12,})/i.test(s) },
];

describe(MCP_JSON, () => {
  const config = read(MCP_JSON);
  const servers = config["mcpServers"] as Record<string, { command: string; args: string[]; env?: unknown }>;

  it("registers jacquard-weave with node and a workspace-relative entry (14.1)", () => {
    const weave = servers["jacquard-weave"];
    expect(weave, `${MCP_JSON}: jacquard-weave`).toBeDefined();
    expect(weave?.command).toBe("node");
    expect(weave?.args).toEqual(["packages/mcp/dist/index.js"]);
    expect(weave?.env, `${MCP_JSON}: jacquard-weave.env`).toBeUndefined();
  });

  it("holds no absolute path, home directory, key or token (14.2)", () => {
    for (const value of strings(config)) {
      for (const rule of FORBIDDEN_VALUE) {
        expect(rule.test(value), `${MCP_JSON}: ${rule.why}: ${JSON.stringify(value)}`).toBe(false);
      }
    }
  });
});

interface Agent {
  tools?: string[];
  excludedTools?: string[];
  permissions?: { rules: { capability: string; match: string[]; effect: string }[] };
}

const WRITE_OR_SHELL = /^(write|shell|fs_write|fs_append|str_replace|delete_file|execute_bash|@builtin|\*|@mcp)$/;

function checkReadOnly(path: string, agent: Agent): void {
  for (const tool of agent.tools ?? []) {
    expect(WRITE_OR_SHELL.test(tool), `${path}: tool ${JSON.stringify(tool)}`).toBe(false);
  }
  for (const rule of agent.permissions?.rules ?? []) {
    if (rule.effect !== "deny" && (rule.capability === "fs_write" || rule.capability === "shell")) {
      throw new Error(`${path}: permission ${JSON.stringify(rule)} grants write or shell`);
    }
    if (rule.effect !== "deny") {
      for (const match of rule.match) {
        expect(match.includes("packages/engine/test/fixtures") && rule.capability !== "fs_read", `${path}: ${match}`).toBe(false);
      }
    }
  }
  const denies = (capability: string) =>
    (agent.permissions?.rules ?? []).some((r) => r.capability === capability && r.effect === "deny" && r.match.some((m) => m === "**" || m === "*"));
  expect(denies("fs_write"), `${path}: fs_write is not denied everywhere`).toBe(true);
  expect(denies("shell"), `${path}: shell is not denied everywhere`).toBe(true);
}

describe(AUDITOR, () => {
  const agent = read(AUDITOR) as Agent;

  it("is read-only with no write or shell tools (14.3, 14.7)", () => {
    checkReadOnly(AUDITOR, agent);
  });

  it("may call exactly the six weave tools and no other MCP tool (14.3, 14.8)", () => {
    const mcpTools = (agent.tools ?? []).filter((tool) => tool.startsWith("@"));
    expect(mcpTools.sort(), AUDITOR).toEqual(WEAVE_TOOLS.map((t) => `@jacquard-weave/${t}`).sort());
    for (const tool of agent.tools ?? []) {
      if (!tool.startsWith("@")) expect(tool, `${AUDITOR}: tool ${tool}`).toBe("read");
    }
    const mcpAllows = (agent.permissions?.rules ?? []).filter((r) => r.capability === "mcp" && r.effect !== "deny");
    for (const rule of mcpAllows) {
      for (const match of rule.match) {
        expect(WEAVE_TOOLS.map((t) => `jacquard-weave/${t}`), `${AUDITOR}: mcp allow ${match}`).toContain(match);
      }
    }
  });
});

describe(REVIEWER, () => {
  const agent = read(REVIEWER) as Agent;

  it("is read-only with read as its only tool and no MCP access (14.5, 14.7)", () => {
    checkReadOnly(REVIEWER, agent);
    expect(agent.tools, REVIEWER).toEqual(["read"]);
    const mcpAllows = (agent.permissions?.rules ?? []).filter((r) => r.capability === "mcp" && r.effect !== "deny");
    expect(mcpAllows, `${REVIEWER}: mcp allow rules`).toEqual([]);
  });
});
