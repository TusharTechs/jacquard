// Script_Data (demo-video 2.1 to 2.7): the one source for the narration, its timing, the claims
// and the beats. script.md, the burned-in captions and the .srt are made from it. Each scene's
// narration is a list of parts, one or two sentences each, with its own window, so the edit can
// meet a phrase exactly and the voice can breathe between parts. Times are seconds from the start
// of the Main_Cut. No imports, so Node scripts can read it as is.

export type SceneId = "problem" | "solution" | "kiro" | "close";

export interface Claim {
  readonly text: string;
  /** The label from product.md or weaving-domain.md, or "tally" or "journal" for build facts. */
  readonly label: string;
  readonly source: string;
}

export interface Beat {
  readonly at: number;
  readonly until: number;
  readonly kind: "capture" | "clip" | "still" | "repo" | "art" | "title";
  readonly ref: string;
  readonly note: string;
}

export interface Part {
  readonly text: string;
  readonly start: number;
  readonly end: number;
}

export interface Scene {
  readonly id: SceneId;
  readonly title: string;
  readonly start: number;
  readonly end: number;
  readonly parts: readonly Part[];
  /** From the first part's start to the last part's end; the score is ducked over it. */
  readonly voice: { readonly start: number; readonly end: number };
  /** All parts, joined. */
  readonly narration: string;
  readonly claims: readonly Claim[];
  readonly beats: readonly Beat[];
}

/** Narration pace the windows are planned for (demo-video 2.2). */
export const WORDS_PER_MINUTE = 140;

type SceneInput = Omit<Scene, "voice" | "narration">;

function scene(input: SceneInput): Scene {
  const parts = input.parts;
  return {
    ...input,
    voice: { start: parts[0]!.start, end: parts[parts.length - 1]!.end },
    narration: parts.map((part) => part.text).join(" "),
  };
}

export const SCENES: readonly Scene[] = [
  scene({
    id: "problem",
    title: "The problem",
    start: 0,
    end: 27.4,
    parts: [
      { text: "Punch cards are dead as a computing medium. Handlooms still use them.", start: 0.6, end: 6.0 },
      { text: "On a jacquard handloom, each card is one row of the design, drawn first on point paper, then punched by a card puncher.", start: 6.4, end: 16.5 },
      { text: "A float that runs too long snags and weakens the cloth.", start: 16.9, end: 21.7 },
      { text: "JACQUARD catches it on point paper, before a single card is punched.", start: 22.0, end: 27.2 },
    ],
    claims: [
      { text: "Punch cards are dead as a computing medium.", label: "framing rule", source: "product.md, Framing rules" },
      { text: "Handlooms still use them.", label: "[sourced, S2, S3]", source: "weaving-domain.md, Sources" },
      { text: "Each card is one row (pick) of the design.", label: "[convention]", source: "weaving-domain.md, Card lacing order; Pick" },
      { text: "Designs are drawn on point paper.", label: "[convention]", source: "weaving-domain.md, Point paper" },
      { text: "Card punchers turn a design into a physical card set.", label: "product description", source: "product.md, Who it is for" },
      { text: "Long floats snag and weaken cloth.", label: "glossary", source: "weaving-domain.md, Float" },
      { text: "JACQUARD checks every float on the design before cards are exported.", label: "product (Must ship)", source: "product.md, Must ship: float check with highlighted violations" },
    ],
    beats: [
      { at: 0, until: 6.4, kind: "art", ref: "card-chain", note: "A laced chain of the Peacock butta's first cards (cardSheetLayout), one at a time, with the app's card clack." },
      { at: 6.4, until: 16.7, kind: "art", ref: "point-paper", note: "Its point paper, one pick lit at a time, with that pick's card beside it." },
      { at: 16.7, until: 21.8, kind: "art", ref: "long-float", note: "The one float checkFloats reports, eased into view and marked in the violation colour." },
      { at: 21.8, until: 27.4, kind: "art", ref: "caught", note: "The flagged float on point paper beside the same pick's card, still unpunched." },
    ],
  }),
  scene({
    id: "solution",
    title: "A working solution",
    start: 27.4,
    end: 86,
    parts: [
      { text: "So I built JACQUARD, for the designer and the card puncher.", start: 27.6, end: 32.4 },
      { text: "This is the live site. I describe a peacock in gold and maroon on a cream ground.", start: 32.5, end: 39.9 },
      { text: "The motif builder reads my words, shows what it understood as chips I can change, and draws it on point paper.", start: 40.0, end: 49.1 },
      { text: "It is a builder, not AI.", start: 49.2, end: 51.8 },
      { text: "The check marks every float over the loom profile's limit.", start: 51.9, end: 56.2 },
      { text: "Auto-fix changes only the lift plan, never my regions, until every float fits.", start: 56.3, end: 61.9 },
      { text: "Now a stylised loom lifts exactly the hooks each card says, and the cloth grows pick by pick, with the app's own sound.", start: 62.0, end: 71.9 },
      { text: "The Cloth view shows the peacocks repeated across the width.", start: 72.0, end: 76.3 },
      { text: "Last, the cards: one per pick, punched and laced in order, ready to print, with a WIF file for weaving software.", start: 76.4, end: 85.4 },
    ],
    claims: [
      { text: "The motif step is a builder, not AI.", label: "framing rule", source: "product.md, Framing rules" },
      { text: "Float limits come from a configurable loom profile.", label: "[decision]", source: "weaving-domain.md, Rules for the engine 2" },
      { text: "Auto-fix changes only lift-plan cells, never region labels.", label: "engine rule", source: "weaving-domain.md, Rules for the engine 5" },
      { text: "One card per pick, laced in order.", label: "[convention]", source: "weaving-domain.md, Card lacing order" },
      { text: "WIF is the interchange format for weaving drafts.", label: "glossary", source: "weaving-domain.md, WIF" },
    ],
    beats: [
      { at: 27.4, until: 32.5, kind: "capture", ref: "opening", note: "The Opening line on the live site." },
      { at: 32.5, until: 46.0, kind: "capture", ref: "describe", note: "Design; typing the peacock; the chips appear; Generate." },
      { at: 46.0, until: 51.9, kind: "capture", ref: "motif", note: "The motif arrives on the point paper cell by cell." },
      { at: 51.9, until: 62.0, kind: "capture", ref: "check", note: "Check: the float violations pulse; Auto-fix places its flips." },
      { at: 62.0, until: 76.4, kind: "capture", ref: "weave", note: "The 3D loom weaving with the app's sound; then the Cloth view on the repeated peacocks." },
      { at: 76.4, until: 86, kind: "capture", ref: "cards", note: "The card chain punching; Print (print stylesheet); the WIF download." },
    ],
  }),
  scene({
    id: "kiro",
    title: "How Kiro built it",
    start: 86,
    end: 152,
    parts: [
      { text: "I built it with Kiro, spec first. Each feature went from requirements to properties to tasks: nine specs, ninety-three property-based tests.", start: 86.4, end: 96.0 },
      { text: "Steering kept every weaving fact labelled.", start: 96.4, end: 99.4 },
      { text: "Three hooks guarded the work, and Kiro surprised me:", start: 100.6, end: 104.6 },
      { text: "none of them fired until I trusted the workspace.", start: 104.8, end: 108.8 },
      { text: "Then the tests surprised me. A lattice test proved the design document's arithmetic wrong, not the code.", start: 109.2, end: 116.6 },
      { text: "A planted bug shrank to a two-pick counterexample.", start: 117.0, end: 120.6 },
      { text: "A property caught a mirrored paisley border that had lost every figure, on its first run.", start: 121.0, end: 127.9 },
      { text: "Five custom agents audited each phase through four MCP servers, one of them our own, and Kiro deployed the site to AWS Amplify.", start: 128.3, end: 138.3 },
      { text: "I shipped a Power and ran Kiro CLI headless on my machine.", start: 138.6, end: 143.9 },
      { text: "One thing Kiro missed: the woven cloth did not show the design until I looked.", start: 144.4, end: 151.2 },
    ],
    claims: [
      { text: "9 specs, 93 property-based tests, 3 hooks, 5 custom agents, 4 MCP servers (3 third-party, 1 our own).", label: "tally", source: "KIRO_JOURNEY.md, Running tally" },
      { text: "Hooks did not fire until the workspace was trusted.", label: "journal", source: "KIRO_JOURNEY.md, 2026-11-16 (hooks.v2.executionDisabledUntrustedWorkspace)" },
      { text: "The lattice example test proved the design note for 5.7 wrong.", label: "journal", source: "KIRO_JOURNEY.md, weave-engine waves 13 and 14" },
      { text: "A planted off-by-one shrank to a plan of 2 picks and 1 end.", label: "journal", source: "KIRO_JOURNEY.md, Planted-bug check" },
      { text: "Property 2 found a mirrored paisley border with no figures on its first run.", label: "journal", source: "KIRO_JOURNEY.md, motif-builder wave 0" },
      { text: "Kiro deployed the site to AWS Amplify Hosting with scripts/deploy-web.sh.", label: "journal", source: "KIRO_JOURNEY.md, deploy-static and motif-builder entries" },
      { text: "One Power shipped; one local Kiro CLI run; Kiro API keys need a paid Kiro plan (on screen only).", label: "tally", source: "KIRO_JOURNEY.md, Running tally (Powers; CLI headless runs in CI)" },
      { text: "The user's review found the woven cloth did not show the design.", label: "journal", source: "KIRO_JOURNEY.md, studio-experience wave 5" },
    ],
    beats: [
      { at: 86, until: 96.2, kind: "repo", ref: "spec-chain", note: "Requirement 2.7, Property 3 and task 1.5 of .kiro/specs/motif-builder, then the tally: 9 specs, 93 property-based tests, 3 hooks, 5 agents, 4 MCP servers." },
      { at: 96.2, until: 100.4, kind: "repo", ref: "steering", note: "One line of weaving-domain.md, large: the handloom line with its [sourced, S2, S3] label." },
      { at: 100.4, until: 104.7, kind: "clip", ref: "hooks", note: "hook-runs.log lines (guard fired, save-hook result: typecheck=0 test=0) and the Run Command Hook panels, enlarged." },
      { at: 104.7, until: 109.0, kind: "repo", ref: "trust", note: "The log line hooks.v2.executionDisabledUntrustedWorkspace, large, from the first frame." },
      { at: 109.0, until: 116.8, kind: "clip", ref: "lattice", note: "The sub-agent's Input required panel: the design's lattice note is wrong for 24 picks." },
      { at: 116.8, until: 120.8, kind: "repo", ref: "planted-bug", note: "The planted bug's shrunk counterexample from the journal: 2 picks, 1 end." },
      { at: 120.8, until: 128.1, kind: "repo", ref: "paisley", note: "Property 2's counterexample (seed 6102) beside the fixed paisley border." },
      { at: 128.1, until: 138.4, kind: "clip", ref: "agents-mcp", note: "Kiro driving Chrome through the Chrome DevTools MCP server; the custom agents and MCP servers; the deploy." },
      { at: 138.4, until: 144.2, kind: "repo", ref: "power-cli", note: "The loom Power and the local Kiro CLI run's VERDICT: PASS; on screen: the CI run needs a paid Kiro API key." },
      { at: 144.2, until: 152, kind: "still", ref: "cloth-before-after", note: "The Weave Step before the review (tag phase-polish) and after it (Cloth view)." },
    ],
  }),
  scene({
    id: "close",
    title: "Honest close",
    start: 152,
    end: 168,
    parts: [
      { text: "The card format is a configurable profile, not yet tested on a working loom.", start: 152.4, end: 158.6 },
      { text: "The site is live and the code is open source; the links are on screen.", start: 159.0, end: 165.6 },
      { text: "Built with Kiro.", start: 165.9, end: 167.5 },
    ],
    claims: [
      { text: "The card format is a configurable loom profile and has not been tested on a working loom.", label: "framing rule", source: "product.md, Framing rules" },
      { text: "The code is open source.", label: "licence", source: "LICENSE (MIT, an OSI-approved licence)" },
    ],
    beats: [{ at: 152, until: 168, kind: "title", ref: "close", note: "Live URL, repository (MIT), Built with Kiro, on card stock." }],
  }),
];

export const DURATION = SCENES[SCENES.length - 1]!.end;

export const LIVE_URL = "https://main.d28e9v65r7sow0.amplifyapp.com";
export const REPO_URL = "https://github.com/TusharTechs/jacquard";

export function wordCount(text: string): number {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean === "" ? 0 : clean.split(" ").length;
}

/** Seconds a part needs at WORDS_PER_MINUTE. */
export function secondsFor(text: string): number {
  return (wordCount(text) / WORDS_PER_MINUTE) * 60;
}
