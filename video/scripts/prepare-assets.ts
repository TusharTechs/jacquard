// Prepares everything the compositions read from public/ (demo-video 4.1, 4.2):
// - Allowed_Footage, trimmed and cropped to drop the macOS menu bar, the Dock, the browser chrome
//   and a system notification (see privacy-log.md for each asset and why);
// - real data for the Problem scene: the Peacock butta gallery design, its lift plan, its float
//   violations and its first cards, computed with @jacquard/engine and @jacquard/export;
// - excerpts of repo files, read from the files themselves.
// Run with `pnpm --filter @jacquard/video assets` (bundled by esbuild, because it imports the
// workspace packages).
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PROFILE_240, buildLiftPlan, checkFloats } from "@jacquard/engine";
import type { Weave, WeaveAssignment } from "@jacquard/engine";
import { cardSheetLayout } from "@jacquard/export";

// Run from video/ (the bundle lives in out/.tmp, so its own path is not used).
const video = process.cwd();
const repo = join(video, "..");
const pub = join(video, "public");
for (const dir of ["media", "data"]) mkdirSync(join(pub, dir), { recursive: true });

function ffmpeg(args: string[]): void {
  execFileSync("ffmpeg", ["-y", "-v", "error", ...args]);
}

// ---- Footage (privacy-log.md lists every range and crop) ----
const journey = join(repo, "media", "journey");
const clips: { out: string; src: string; from: number; to: number; crop: string }[] = [
  // hook-runs.log lines only: the crop starts below the terminal's prompt line, which shows the
  // local account and host name, so no frame of the range holds it (checked frame by frame).
  { out: "hooks-log.mp4", src: "2026-11-16-clip-hooks-firing-live-wave7.mp4", from: 16.5, to: 21.5, crop: "crop=762:278:478:822" },
  // The agent's "Input required" panel, for a readable close-up.
  { out: "lattice-panel.mp4", src: "2026-11-16-clip-lattice-test-finds-design-error.mp4", from: 87.5, to: 95, crop: "crop=572:700:1334:240" },
  // The page only: no tabs, address bar, profile button, notification, Dock or menu bar.
  { out: "chrome-mcp.mp4", src: "2026-11-16-clip-kiro-drives-chrome-devtools-mcp.mp4", from: 66, to: 80, crop: "crop=1566:940:30:185" },
];
for (const clip of clips) {
  ffmpeg(["-ss", String(clip.from), "-to", String(clip.to), "-i", join(journey, clip.src), "-vf", `${clip.crop},fps=30,format=yuv420p`, "-an", "-c:v", "libx264", "-crf", "16", "-preset", "slow", join(pub, "media", clip.out)]);
}
// Stills. The two Run Command Hook panels at 22 s of the hooks clip, below the Run Command box
// that shows a home-directory path.
ffmpeg(["-ss", "22", "-i", join(journey, "2026-11-16-clip-hooks-firing-live-wave7.mp4"), "-frames:v", "1", "-vf", "crop=486:142:1376:588", join(pub, "media", "hooks-panel.png")]);
copyFileSync(join(repo, "media", "motif-builder", "paisley-border-paper-1440.png"), join(pub, "media", "paisley-fixed.png"));
copyFileSync(join(repo, "media", "polish", "weave-cloth-peacock-1440.png"), join(pub, "media", "cloth-after.png"));
// The same still before the user's review: media/polish/weave-1440.png at tag phase-polish.
writeFileSync(join(pub, "media", "cloth-before.png"), execFileSync("git", ["-C", repo, "show", "ca00bff:media/polish/weave-1440.png"]));

// ---- Problem scene data: the Peacock butta from the gallery ----
const gallery = JSON.parse(readFileSync(join(repo, "apps", "web", "public", "gallery", "peacock-butta.json"), "utf8")) as {
  design: number[][];
  palette: string[];
  weaves: Record<string, Weave>;
  setup: { repeatAcross: boolean };
};
const CYCLE: readonly Weave[] = [
  { kind: "twill", up: 1, down: 3, direction: "Z" },
  { kind: "satin", size: 5, move: 2, facing: "weft" },
  { kind: "twill", up: 3, down: 1, direction: "S" },
  { kind: "satin", size: 8, move: 3, facing: "warp" },
];
const weaves: WeaveAssignment = Object.fromEntries(
  Array.from({ length: 8 }, (_, region) => [region, gallery.weaves[String(region)] ?? (region === 0 ? { kind: "plain" } : CYCLE[(region - 1) % CYCLE.length]!)]),
);
const built = buildLiftPlan({ design: gallery.design, weaves, profile: PROFILE_240, repeatAcross: gallery.setup.repeatAcross });
if (!built.ok) throw new Error(`buildLiftPlan: ${built.error.code}`);
const floats = checkFloats(built.value.plan, PROFILE_240);
if (!floats.ok) throw new Error(`checkFloats: ${floats.error.code}`);
const cards = cardSheetLayout(built.value.plan, PROFILE_240);
if (!cards.ok) throw new Error(`cardSheetLayout: ${cards.error.code}`);
const violation = floats.value.find((item) => item.kind === "float");
writeFileSync(
  join(pub, "data", "problem.json"),
  JSON.stringify({
    design: gallery.design,
    palette: gallery.palette,
    width: built.value.plan.designWidth,
    picks: built.value.plan.pickCount,
    lifts: built.value.plan.lifts.map((row) => row.slice(0, built.value.plan.designWidth)),
    maxFloat: { warp: PROFILE_240.maxWarpFloat, weft: PROFILE_240.maxWeftFloat },
    violation,
    card: {
      width: cards.value.cardWidth,
      height: cards.value.cardHeight,
      holeRadius: cards.value.holeRadius,
      laceRadius: cards.value.laceRadius,
      numberX: cards.value.numberX,
      numberY: cards.value.numberY,
      cards: cards.value.cards.slice(0, 12).concat(violation !== undefined && "pick" in violation ? [cards.value.cards[violation.pick]!] : []),
    },
  }),
);

// ---- Repo excerpts, read from the files ----
const read = (path: string): string[] => readFileSync(join(repo, path), "utf8").split("\n");
const find = (lines: string[], test: (line: string) => boolean): number => {
  const index = lines.findIndex(test);
  if (index === -1) throw new Error("excerpt line not found");
  return index;
};
const requirements = read(".kiro/specs/motif-builder/requirements.md");
const design = read(".kiro/specs/motif-builder/design.md");
const tasks = read(".kiro/specs/motif-builder/tasks.md");
const steering = read(".kiro/steering/weaving-domain.md");
const journal = read("KIRO_JOURNEY.md");
const reqLine = find(requirements, (line) => line.startsWith("7. ON the Default_Setup, every Builder motif"));
const propLine = find(design, (line) => line.startsWith("### Property 3:"));
const taskLine = find(tasks, (line) => line.includes("1.5 Write property test"));
const pick = (lines: string[], tests: ((line: string) => boolean)[]): string[] => tests.map((test) => lines[find(lines, test)]!);
const planted = find(journal, (line) => line.includes("**Property 23: Violations are over the limit"));
const paisley = find(journal, (line) => line.startsWith("1. **Property 2: Builder output** (Requirements 2.2, 2.6), seed 6102"));
const mcp = Object.keys((JSON.parse(readFileSync(join(repo, ".kiro", "settings", "mcp.json"), "utf8")) as { mcpServers: Record<string, unknown> }).mcpServers);
const cliLog = read("media/journey/2026-11-16-kiro-cli-spec-check-local.txt");
const plugin = JSON.parse(readFileSync(join(repo, "power", "plugin.json"), "utf8")) as { name: string; version: string };
const excerpts = {
  specChain: [
    { file: ".kiro/specs/motif-builder/requirements.md", line: reqLine + 1, text: requirements[reqLine]! },
    { file: ".kiro/specs/motif-builder/design.md", line: propLine + 1, text: [design[propLine]!, design[propLine + 1]!, design[propLine + 2]!].join("\n") },
    { file: ".kiro/specs/motif-builder/tasks.md", line: taskLine + 1, text: tasks[taskLine]!.trim() },
  ],
  steering: pick(steering, [
    (line) => line.startsWith("- **Hook**"),
    (line) => line.startsWith("- **Point paper**"),
    (line) => line.startsWith("- **Card layout**"),
    (line) => line.startsWith("- Handlooms still weaving"),
  ]),
  hookJson: readFileSync(join(repo, ".kiro", "hooks", "block-engine-fixture-edits.json"), "utf8"),
  hookNames: ["block-engine-fixture-edits", "engine-typecheck-and-test-on-save", "journey-entry-on-stop"].filter((name) => existsSync(join(repo, ".kiro", "hooks", `${name}.json`))),
  trust: journal[find(journal, (line) => line.includes("hooks.v2.executionDisabledUntrustedWorkspace"))]!,
  planted: journal.slice(planted, planted + 4).map((line) => line.trim()),
  paisley: journal.slice(paisley, paisley + 3).map((line) => line.trim()),
  agents: ["weave-auditor", "design-reviewer", "spec-checker", "release-runner", "journey-scribe"].filter((name) => existsSync(join(repo, ".kiro", "agents", `${name}.json`))),
  mcp,
  power: `${plugin.name} ${plugin.version}`,
  cliVerdict: cliLog.find((line) => line.startsWith("VERDICT:"))?.slice(0, "VERDICT: PASS".length) ?? "",
};
// Privacy (demo-video 4.1): no home-directory path, account, host or full name in any text the
// video shows; and no figure taken only from a weaver's own page (Tushar's review, item 7).
const FORBIDDEN = [/\/Users\//, /techtush/i, /@192/, /Tushar Agarwal/, /42[,.]?000/];
const shown = JSON.stringify(excerpts) + readFileSync(join(pub, "data", "problem.json"), "utf8");
for (const pattern of FORBIDDEN) if (pattern.test(shown)) throw new Error(`excerpts contain ${pattern}`);
writeFileSync(join(pub, "data", "excerpts.json"), JSON.stringify(excerpts, null, 1));
writeFileSync(join(pub, "data", "assets.json"), JSON.stringify({ voice: existsSync(join(pub, "audio", "voice.wav")) }));
console.log(`public/media: ${clips.length} clips, 4 stills; public/data: problem.json (violation ${violation === undefined ? "none" : "found"}), excerpts.json`);
