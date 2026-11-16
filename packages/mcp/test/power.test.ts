// The loom Power (kiro-product 1.1 to 1.6): manifest fields, the MCP config, a byte-for-byte rebuild
// of the committed server bundle, a run of the bundle outside the repository with no node_modules,
// and the skill frontmatter and framing rules.
import { execFileSync, spawn } from "node:child_process";
import { copyFileSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { builtinModules } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, "..");
const workspaceRoot = join(packageRoot, "..", "..");
const powerRoot = join(workspaceRoot, "power");
const SERVER = join(powerRoot, "dist", "server.js");
const UNTESTED = "The card format has not been tested on a working loom.";
const TOOL_NAMES = ["list_profiles", "build_lift_plan", "check_floats", "auto_fix", "build_cards", "decode_cards"];

const temps: string[] = [];
function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "loom-power-"));
  temps.push(dir);
  return dir;
}
afterAll(() => {
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

/** Every string anywhere in a JSON value, keys included. */
function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value !== null && typeof value === "object") {
    return Object.entries(value).flatMap(([key, inner]) => [key, ...strings(inner)]);
  }
  return [];
}

describe("power/plugin.json (1.1)", () => {
  const plugin = readJson(join(powerRoot, "plugin.json"));
  it("has the schema, name, version, description, author, keywords, repository and licence", () => {
    expect(plugin["$schema"]).toBe("https://agent-plugins.org/schemas/1.0.0/plugin.schema.json");
    expect(plugin["name"]).toBe("loom");
    expect(plugin["version"]).toMatch(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/);
    expect(typeof plugin["description"]).toBe("string");
    expect((plugin["description"] as string).length).toBeGreaterThan(0);
    const author = plugin["author"] as Record<string, unknown>;
    expect(typeof author["name"]).toBe("string");
    expect(Array.isArray(plugin["keywords"])).toBe(true);
    expect((plugin["keywords"] as unknown[]).length).toBeGreaterThan(0);
    expect(plugin["repository"]).toBe("https://github.com/TusharTechs/jacquard");
    expect(plugin["license"]).toBe("MIT");
  });
});

describe("power/mcp.json (1.2)", () => {
  const config = readJson(join(powerRoot, "mcp.json"));
  it("has the schema and only mcpServers", () => {
    expect(Object.keys(config).sort()).toEqual(["$schema", "mcpServers"]);
    expect(config["$schema"]).toBe("https://agent-plugins.org/schemas/1.0.0/mcp.schema.json");
  });
  it("starts one stdio server with node and the bundled entry under PLUGIN_ROOT", () => {
    const servers = config["mcpServers"] as Record<string, Record<string, unknown>>;
    expect(Object.keys(servers)).toEqual(["loom"]);
    const loom = servers["loom"] as Record<string, unknown>;
    expect(loom["type"]).toBe("stdio");
    expect(loom["command"]).toBe("node");
    expect(loom["args"]).toEqual(["${PLUGIN_ROOT}/dist/server.js"]);
    expect(loom["env"], "mcp.json: loom.env").toBeUndefined();
  });
  it("holds no absolute path, home directory or secret", () => {
    for (const value of strings(config)) {
      if (value.startsWith("https://agent-plugins.org/")) continue;
      expect(value.startsWith("/") || /^[A-Za-z]:[\\/]/.test(value), `absolute path: ${value}`).toBe(false);
      expect(value.includes("~") || value.includes("/Users/") || value.includes("/home/"), `home: ${value}`).toBe(false);
      expect(/(api[_-]?key|token|secret|password|AKIA[0-9A-Z]{12,})/i.test(value), `secret: ${value}`).toBe(false);
    }
  });
});

describe("power/dist/server.js (1.3, 1.4)", () => {
  it("is byte-identical to a fresh --power build", () => {
    const out = join(tempDir(), "server.js");
    execFileSync("node", ["build.mjs", "--power", "--outfile", out], { cwd: packageRoot, stdio: "pipe" });
    const fresh = readFileSync(out);
    const committed = readFileSync(SERVER);
    expect(fresh.equals(committed), "power/dist/server.js differs from a fresh build; run pnpm --filter @jacquard/mcp build:power").toBe(true);
  });

  it("starts with the banner and imports no package from node_modules", () => {
    const text = readFileSync(SERVER, "utf8");
    expect(text.startsWith(`// loom Power MCP server, bundled from @jacquard/mcp. ${UNTESTED}\n`)).toBe(true);
    const bare = [...text.matchAll(/^import\s[^;]*?from\s*["']([^"']+)["']/gm)].map((m) => m[1] as string);
    expect(bare.length).toBeGreaterThan(0);
    for (const specifier of bare) {
      expect(builtinModules.includes(specifier.replace(/^node:/, "")), `non-builtin import: ${specifier}`).toBe(true);
    }
  });

  it("answers initialize within 5 s and lists the six tools from a folder outside the repository", async () => {
    const dir = tempDir();
    copyFileSync(SERVER, join(dir, "server.js"));
    expect(readdirSync(dir)).toEqual(["server.js"]);
    const child = spawn("node", ["server.js"], { cwd: dir, stdio: ["pipe", "pipe", "pipe"] });
    let out = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      out += chunk;
    });
    child.stderr.resume();
    const waitFor = (id: number, timeoutMs: number): Promise<Record<string, unknown>> =>
      new Promise((resolve, reject) => {
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
    const send = (message: unknown): void => {
      child.stdin.write(`${JSON.stringify(message)}\n`);
    };
    try {
      const started = Date.now();
      send({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "power-test", version: "0" } },
      });
      const init = await waitFor(1, 5000);
      expect(Date.now() - started).toBeLessThan(5000);
      expect(init["result"]).toBeDefined();
      send({ jsonrpc: "2.0", method: "notifications/initialized" });
      send({ jsonrpc: "2.0", id: 2, method: "tools/list" });
      const listed = await waitFor(2, 5000);
      const tools = (listed["result"] as { tools: { name: string }[] }).tools;
      expect(tools.map((tool) => tool.name)).toEqual(TOOL_NAMES);
    } finally {
      await new Promise<void>((resolve) => {
        if (child.exitCode !== null) {
          resolve();
          return;
        }
        child.once("exit", () => resolve());
        child.stdin.end();
        child.kill();
      });
    }
  });
});

interface Frontmatter {
  readonly fields: Record<string, string>;
  readonly body: string;
}

/** Parses `---` delimited frontmatter of single-line `key: value` pairs. */
function frontmatter(text: string): Frontmatter {
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text);
  if (match === null) throw new Error("no frontmatter");
  const fields: Record<string, string> = {};
  for (const line of (match[1] as string).split("\n")) {
    const at = line.indexOf(":");
    if (at === -1) throw new Error(`frontmatter line without a colon: ${line}`);
    fields[line.slice(0, at).trim()] = line.slice(at + 1).trim();
  }
  return { fields, body: match[2] as string };
}

describe("power/skills (1.5, 1.6)", () => {
  const skillsRoot = join(powerRoot, "skills");
  const folders = readdirSync(skillsRoot).filter((name) => statSync(join(skillsRoot, name)).isDirectory()).sort();

  it("has the two skills", () => {
    expect(folders).toEqual(["check-floats-and-cards", "design-woven-pattern"]);
  });

  for (const folder of folders) {
    const text = readFileSync(join(skillsRoot, folder, "SKILL.md"), "utf8");
    const { fields, body } = frontmatter(text);

    it(`${folder}: name equals the folder and follows the naming rule`, () => {
      expect(fields["name"]).toBe(folder);
      expect(folder).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(folder.length).toBeLessThanOrEqual(64);
    });

    it(`${folder}: description is present and at most 1024 characters`, () => {
      const description = fields["description"] ?? "";
      expect(description.length).toBeGreaterThan(0);
      expect(description.length).toBeLessThanOrEqual(1024);
    });

    it(`${folder}: states the framing rules`, () => {
      expect(body).toContain(UNTESTED);
      expect(body).toMatch(/assist the designer and the card puncher/);
      for (const label of ["[sourced]", "[convention]", "[decision]", "[to verify]"]) expect(body).toContain(label);
    });
  }
});

describe("power/README.md (1.7)", () => {
  const readme = readFileSync(join(powerRoot, "README.md"), "utf8");
  it("opens by saying punch cards are dead as a computing medium", () => {
    const firstLine = readme.split("\n").find((line) => line.trim() !== "" && !line.startsWith("#")) ?? "";
    expect(firstLine).toContain("Punch cards are dead as a computing medium");
  });
  it("gives the GitHub and local-folder installs and the fresh-workspace test", () => {
    expect(readme).toContain("Import power from GitHub");
    expect(readme).toContain("Import power from a folder");
    expect(readme).toContain("Test it in a fresh empty workspace");
    expect(readme).toContain("has not been tested on a working loom");
  });
});
