// Source, build and repository scans (2.1, 2.4, 13.3).
// (a) apps/web/src names no model provider endpoint or auth header.
// (b) a fresh production build contains no AWS credential or model endpoint URL. The build goes to
//     a temporary folder inside this test, so the scan never reads a stale `dist`.
// (c) no git-tracked or new unignored file holds an AWS access key id or a 40-character secret
//     assigned to a key name.
// (d, e) apps/web/src imports the engine and motif only through their bare package names, and
//     never through a path into packages/.
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = join(here, "..");
const srcRoot = join(webRoot, "src");
const workspaceRoot = join(webRoot, "..", "..");

function filesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...filesUnder(path));
    else if (entry.isFile()) out.push(path);
  }
  return out.sort();
}

function matchesIn(files: readonly string[], root: string, patterns: readonly RegExp[]): string[] {
  const hits: string[] = [];
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    for (const pattern of patterns) {
      const found = text.match(new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`));
      if (found !== null) hits.push(`${relative(root, file)}: ${pattern.source} (${found.length})`);
    }
  }
  return hits;
}

/** AWS access key id. */
const ACCESS_KEY_ID = /AKIA[0-9A-Z]{16}/;
/** A 40-character AWS-style secret assigned to a name that says it is a secret key. */
const ASSIGNED_SECRET =
  /(aws_?secret_?access_?key|secret_?access_?key|aws_?secret(_?key)?|secretAccessKey)["']?\s*[:=]\s*["']?[A-Za-z0-9/+]{40}(?![A-Za-z0-9/+=])/i;

describe("scan patterns", () => {
  // Built from parts so this file never holds a literal that the repository scan would flag.
  const fakeId = "AKIA" + "ABCDEFGHIJKLMNOP";
  const fakeSecret = "wJalrXUtnFEMI/K7MDENG/bPxRfiCY" + "EXAMPLEKEY";
  it("the key patterns match what they are meant to match", () => {
    expect(fakeSecret).toHaveLength(40);
    expect(ACCESS_KEY_ID.test(`key = ${fakeId}`)).toBe(true);
    expect(ACCESS_KEY_ID.test("AKIA" + "abc")).toBe(false);
    expect(ASSIGNED_SECRET.test(`aws_secret_access_key = ${fakeSecret}`)).toBe(true);
    expect(ASSIGNED_SECRET.test(`"secretAccessKey": "${fakeSecret}"`)).toBe(true);
    expect(ASSIGNED_SECRET.test(`AWS_SECRET_ACCESS_KEY=${fakeSecret}`)).toBe(true);
    expect(ASSIGNED_SECRET.test(`aws_secret_access_key = ${fakeSecret}X`)).toBe(false);
    expect(ASSIGNED_SECRET.test("aws_secret_access_key = <from Secrets Manager>")).toBe(false);
  });
});

describe("apps/web/src (2.1)", () => {
  const files = filesUnder(srcRoot);

  it("has source files to scan", () => {
    expect(files.some((file) => file.endsWith("app.tsx"))).toBe(true);
  });

  it("names no model provider endpoint, provider SDK or auth header", () => {
    const patterns = [/bedrock/i, /amazonaws\.com/i, /anthropic/i, /api\.openai/i, /x-api-key/i, /authorization/i];
    expect(matchesIn(files, webRoot, patterns)).toEqual([]);
  });

  it("sends motif requests only to /api/motif", () => {
    const fetchUrls = files.flatMap((file) => [...readFileSync(file, "utf8").matchAll(/https?:\/\/[^\s"'`)]+/g)].map((m) => `${relative(webRoot, file)}: ${m[0]}`));
    expect(fetchUrls).toEqual([]);
    const client = readFileSync(join(srcRoot, "lib", "motif-client.ts"), "utf8");
    expect(client).toContain("/api/motif");
  });
});

describe("imports in apps/web/src (13.3)", () => {
  const files = filesUnder(srcRoot).filter((file) => [".ts", ".tsx"].includes(extname(file)));
  const specifiers = files.flatMap((file) => {
    const text = readFileSync(file, "utf8");
    const found = [
      ...text.matchAll(/\b(?:import|export)\b[^"'`;]*?\bfrom\s*["']([^"']+)["']/g),
      ...text.matchAll(/\bimport\s*["']([^"']+)["']/g),
      ...text.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g),
      ...text.matchAll(/\brequire\s*\(\s*["']([^"']+)["']\s*\)/g),
    ];
    return found.map((match) => ({ file, specifier: match[1] ?? "" }));
  });

  it("finds the engine and motif imports", () => {
    const names = new Set(specifiers.map((entry) => entry.specifier));
    expect(names.has("@jacquard/engine")).toBe(true);
    expect(names.has("@jacquard/motif")).toBe(true);
  });

  it("imports @jacquard/engine, @jacquard/motif and @jacquard/export only by their bare package names", () => {
    const bad = specifiers
      .filter(({ specifier }) => /(^|\/)@jacquard\//.test(specifier) || /(^|[/.])(engine|motif|export)\/src(\/|$)/.test(specifier))
      .filter(({ specifier }) => specifier !== "@jacquard/engine" && specifier !== "@jacquard/motif" && specifier !== "@jacquard/export")
      .map(({ file, specifier }) => `${relative(webRoot, file)}: ${specifier}`);
    expect(bad).toEqual([]);
  });

  it("never imports from a packages/ path or from outside apps/web/src", () => {
    const bad = specifiers
      .filter(({ file, specifier }) => {
        if (/(^|\/)packages\//.test(specifier)) return true;
        if (!specifier.startsWith(".")) return false;
        const target = resolve(dirname(file), specifier);
        return target !== srcRoot && !target.startsWith(srcRoot + sep);
      })
      .map(({ file, specifier }) => `${relative(webRoot, file)}: ${specifier}`);
    expect(bad).toEqual([]);
  });
});

describe("production build (2.4)", () => {
  let outDir = "";

  beforeAll(() => {
    outDir = mkdtempSync(join(tmpdir(), "jacquard-web-build-"));
    const vite = join(webRoot, "node_modules", "vite", "bin", "vite.js");
    execFileSync(process.execPath, [vite, "build", "--outDir", outDir, "--emptyOutDir", "--logLevel", "error"], {
      cwd: webRoot,
      stdio: "pipe",
      timeout: 120_000,
    });
  }, 150_000);

  afterAll(() => {
    if (outDir !== "" && existsSync(outDir)) rmSync(outDir, { recursive: true, force: true });
  });

  it("produces index.html and JavaScript", () => {
    const files = filesUnder(outDir);
    expect(files.some((file) => file.endsWith("index.html"))).toBe(true);
    expect(files.some((file) => file.endsWith(".js") && statSync(file).size > 0)).toBe(true);
  });

  it("keeps three.js, react-three and tone out of the entry chunk (studio-experience 14.1)", () => {
    const html = readFileSync(join(outDir, "index.html"), "utf8");
    const entry = /<script type="module"[^>]*src="\/([^"]+\.js)"/.exec(html)?.[1];
    expect(entry).toBeTruthy();
    const code = readFileSync(join(outDir, entry!), "utf8");
    // Names that only the 3D loom (three, @react-three/fiber, drei) and the sound (tone) bring.
    for (const marker of ["WebGLRenderer", "useFrame", "MeshStandardMaterial", "MembraneSynth", "NoiseSynth"]) {
      expect(code.includes(marker), marker).toBe(false);
    }
    const chunks = filesUnder(join(outDir, "assets")).filter((file) => file.endsWith(".js"));
    expect(chunks.some((file) => readFileSync(file, "utf8").includes("WebGLRenderer"))).toBe(true);
    expect(chunks.some((file) => readFileSync(file, "utf8").includes("MembraneSynth"))).toBe(true);
  });

  it("contains no AWS credential or model endpoint URL", () => {
    const patterns = [ACCESS_KEY_ID, ASSIGNED_SECRET, /aws_secret_access_key/i, /bedrock-runtime/i, /amazonaws\.com/i, /anthropic/i, /x-api-key/i];
    expect(matchesIn(filesUnder(outDir), outDir, patterns)).toEqual([]);
  });
});

describe("repository (2.4)", () => {
  /** Large or binary media are skipped; every other tracked or new unignored file is read. */
  const SKIP = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".mp4", ".mov", ".mkv", ".pdf", ".ico", ".woff", ".woff2"]);
  const listed = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], {
    cwd: workspaceRoot,
    encoding: "utf8",
  })
    .split("\0")
    .filter((path) => path !== "");
  const files = listed
    .filter((path) => !SKIP.has(extname(path).toLowerCase()))
    .map((path) => join(workspaceRoot, path))
    .filter((path) => existsSync(path) && statSync(path).isFile());

  it("lists the repository files", () => {
    expect(files.length).toBeGreaterThan(50);
    expect(files.some((file) => file.endsWith("PLAN.md"))).toBe(true);
  });

  it("holds no AWS access key id and no 40-character secret assigned to a key name", () => {
    expect(matchesIn(files, workspaceRoot, [ACCESS_KEY_ID, ASSIGNED_SECRET])).toEqual([]);
  });
});
