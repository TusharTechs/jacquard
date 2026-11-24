// Script_Data (demo-video 2.1 to 2.7): the one source for the narration, scene windows, caption
// windows, claims and beats. script.md, the burned-in captions and the .srt are made from it.
// Times are seconds from the start of the Main_Cut. No imports, so Node scripts can read it as is.

export type SceneId = "problem" | "solution" | "kiro" | "close";

export interface Claim {
  readonly text: string;
  /** The label from product.md or weaving-domain.md, or "tally" for build numbers. */
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

export interface Scene {
  readonly id: SceneId;
  readonly title: string;
  readonly start: number;
  readonly end: number;
  /** When the voice speaks; captions fill this window. */
  readonly voice: { readonly start: number; readonly end: number };
  readonly narration: string;
  readonly claims: readonly Claim[];
  readonly beats: readonly Beat[];
}

/** Narration pace the windows are planned for (demo-video 2.2). */
export const WORDS_PER_MINUTE = 140;

export const SCENES: readonly Scene[] = [
  {
    id: "problem",
    title: "The problem",
    start: 0,
    end: 21,
    voice: { start: 0.6, end: 20.4 },
    narration:
      "Punch cards are dead as a computing medium. Handlooms still use them. On a jacquard handloom, each card is one row of the design, drawn first on point paper, then punched by a card puncher. A float that runs too long snags and weakens the cloth.",
    claims: [
      { text: "Punch cards are dead as a computing medium.", label: "framing rule", source: "product.md, Framing rules" },
      { text: "Handlooms still use them.", label: "[sourced, S2, S3]", source: "weaving-domain.md, Sources" },
      { text: "Each card is one row (pick) of the design.", label: "[convention]", source: "weaving-domain.md, Card lacing order; Pick" },
      { text: "Designs are drawn on point paper.", label: "[convention]", source: "weaving-domain.md, Point paper" },
      { text: "Card punchers turn a design into a physical card set.", label: "product description", source: "product.md, Who it is for" },
      { text: "Long floats snag and weaken cloth.", label: "glossary", source: "weaving-domain.md, Float" },
    ],
    beats: [
      { at: 0, until: 7, kind: "art", ref: "card-chain", note: "A laced chain of punched cards from the real card export, drifting down." },
      { at: 7, until: 14, kind: "art", ref: "point-paper", note: "Point paper of the Lotus border, one pick row lit, its card beside it." },
      { at: 14, until: 21, kind: "art", ref: "long-float", note: "One warp end on the point paper, a float over the limit marked in the app's violation colour." },
    ],
  },
  {
    id: "solution",
    title: "A working solution",
    start: 21,
    end: 86,
    voice: { start: 21.4, end: 85.4 },
    narration:
      "So I built JACQUARD, for the designer and the card puncher. This is the live site. I describe a peacock in gold and maroon on a cream ground. The motif builder reads my words, shows what it understood as chips I can change, and draws it on point paper. It is a builder, not AI. The check marks every float over the loom profile's limit. Auto-fix changes only the lift plan, never my regions, until every float fits. Now a stylised loom lifts exactly the hooks each card says, and the cloth grows pick by pick, with the app's own sound. The Cloth view shows the peacocks repeated across the width. Last, the cards: one per pick, punched and laced in order, ready to print, with a WIF file for weaving software.",
    claims: [
      { text: "The motif step is a builder, not AI.", label: "framing rule", source: "product.md, Framing rules" },
      { text: "Float limits come from a configurable loom profile.", label: "[decision]", source: "weaving-domain.md, Rules for the engine 2" },
      { text: "Auto-fix changes only lift-plan cells, never region labels.", label: "engine rule", source: "weaving-domain.md, Rules for the engine 5" },
      { text: "One card per pick, laced in order.", label: "[convention]", source: "weaving-domain.md, Card lacing order" },
      { text: "WIF is the interchange format for weaving drafts.", label: "glossary", source: "weaving-domain.md, WIF" },
    ],
    beats: [
      { at: 21, until: 26, kind: "capture", ref: "opening", note: "The Opening line on the live site." },
      { at: 26, until: 40, kind: "capture", ref: "describe", note: "Typing the peacock; chips appear; Generate; the motif arrives cell by cell." },
      { at: 40, until: 50, kind: "capture", ref: "check", note: "Float violations pulsing, then Auto-fix placing its flips." },
      { at: 50, until: 66, kind: "capture", ref: "weave", note: "The 3D loom weaving with sound; the Cloth view easing in on the peacocks." },
      { at: 66, until: 86, kind: "capture", ref: "cards", note: "The card chain punching; Print; the WIF download." },
    ],
  },
  {
    id: "kiro",
    title: "How Kiro built it",
    start: 86,
    end: 152,
    voice: { start: 86.4, end: 151.4 },
    narration:
      "I built it with Kiro, spec first. Each feature went from requirements to correctness properties to tasks: eight specs, ninety property-based tests. Steering kept every weaving fact labelled. Three hooks guarded the work, and Kiro surprised me on day one: none of them fired until I trusted the workspace. Then the tests surprised me. A lattice test proved the design document's arithmetic wrong, not the code. A planted bug shrank to a two-pick counterexample. A property caught a mirrored paisley border that had lost every figure, on its first run. Custom agents audited each phase through our MCP server, Chrome DevTools checked the live site, and AWS Documentation guided the Amplify deploy that Kiro ran. I also shipped a Power, and ran Kiro CLI headless on my machine; the CI run needs a paid API key. One thing Kiro missed: the woven cloth did not show the design until I looked.",
    claims: [
      { text: "8 specs, 90 property-based tests, 3 hooks, 5 custom agents, 4 MCP servers.", label: "tally", source: "KIRO_JOURNEY.md, Running tally" },
      { text: "Hooks did not fire until the workspace was trusted.", label: "journal", source: "KIRO_JOURNEY.md, 2026-11-16 (hooks.v2.executionDisabledUntrustedWorkspace)" },
      { text: "The lattice example test proved the design note for 5.7 wrong.", label: "journal", source: "KIRO_JOURNEY.md, weave-engine waves 13 and 14" },
      { text: "A planted off-by-one shrank to a plan of 2 picks and 1 end.", label: "journal", source: "KIRO_JOURNEY.md, Planted-bug check" },
      { text: "Property 2 found a mirrored paisley border with no figures on its first run.", label: "journal", source: "KIRO_JOURNEY.md, motif-builder wave 0" },
      { text: "The user's review found the woven cloth did not show the design.", label: "journal", source: "KIRO_JOURNEY.md, studio-experience wave 5" },
      { text: "One Power shipped; one local Kiro CLI run; Kiro API keys need a paid Kiro plan.", label: "tally", source: "KIRO_JOURNEY.md, Running tally (Powers; CLI headless runs in CI)" },
    ],
    beats: [
      { at: 86, until: 96, kind: "repo", ref: "spec-chain", note: "A requirement, the property that validates it, and the task that tests it, from .kiro/specs/motif-builder." },
      { at: 96, until: 101, kind: "repo", ref: "steering", note: "weaving-domain.md with its labels." },
      { at: 101, until: 110, kind: "clip", ref: "hooks", note: "Hooks firing live after the workspace was trusted; the hook JSON beside it." },
      { at: 110, until: 117, kind: "clip", ref: "lattice", note: "The lattice test failing on the design's arithmetic." },
      { at: 117, until: 123, kind: "still", ref: "planted-bug", note: "The planted bug's shrunk counterexample." },
      { at: 123, until: 130, kind: "repo", ref: "paisley", note: "Property 2's counterexample from the journal, beside the fixed paisley border." },
      { at: 130, until: 138, kind: "clip", ref: "agents-mcp", note: "Kiro driving Chrome DevTools; the agent and MCP list; the deploy headers." },
      { at: 138, until: 145, kind: "repo", ref: "power-cli", note: "The Power's plugin.json and the local Kiro CLI run's VERDICT line." },
      { at: 145, until: 152, kind: "still", ref: "cloth-before-after", note: "The cloth before and after the user's review." },
    ],
  },
  {
    id: "close",
    title: "Honest close",
    start: 152,
    end: 168,
    voice: { start: 152.4, end: 167.2 },
    narration:
      "The card format is a configurable profile, not yet tested on a working loom. The motif step is a builder, not AI. The site is live; the links are on screen. Built with Kiro.",
    claims: [
      { text: "The card format is a configurable loom profile and has not been tested on a working loom.", label: "framing rule", source: "product.md, Framing rules" },
    ],
    beats: [
      { at: 152, until: 168, kind: "title", ref: "close", note: "Live URL, repository, Built with Kiro, on card stock." },
    ],
  },
];

export const DURATION = SCENES[SCENES.length - 1]!.end;

export const LIVE_URL = "https://main.d28e9v65r7sow0.amplifyapp.com";
export const REPO_URL = "https://github.com/TusharTechs/jacquard";

export function wordCount(text: string): number {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean === "" ? 0 : clean.split(" ").length;
}
