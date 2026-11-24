// `pnpm --filter @jacquard/video tts` (demo-video Requirement 9): writes voice/lines/01.wav to
// 26.wav with Kokoro-82M, run locally in voice/tts/.venv, from the script text, sentence by
// sentence. Then it measures each line's speech, speeds up (at most 1.05) any line longer than its
// window, transcribes every line with faster-whisper (local), compares the transcript with the
// script, and writes out/tts-report.json. It fails if any transcript differs in more than
// punctuation. No cloud service, account or key; weights are cached in ~/.cache/jacquard-tts.
// Options: --samples (the sample voices on lines 01, 07, 18 and 21, into out/voice-samples/),
// --voice <name>, --only 3,12 (regenerate some lines).
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { wordCount } from "../src/script.ts";
import { splitSentences } from "../src/cues.ts";
import { BASE_SPEED, CHOSEN_VOICE, SAMPLE_LINES, SAMPLE_VOICES, SENTENCE_PAUSE, checkLine, chooseSpeed, fills, lineSeed, retryTakes, speechSentences } from "../src/tts.ts";
import { VOICE_RATE, trimBounds, voiceLines } from "../src/voice.ts";
import type { VoiceLine } from "../src/voice.ts";

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
};
const samples = args.includes("--samples");
const voice = flag("--voice") ?? CHOSEN_VOICE;
const only = flag("--only")?.split(",").map(Number);

const python = join("voice", "tts", ".venv", "bin", "python");
if (!existsSync(python)) {
  console.error("No voice/tts/.venv. Create it: cd voice/tts && uv sync --frozen");
  process.exit(1);
}
const env = { ...process.env, HF_HUB_CACHE: process.env["HF_HUB_CACHE"] ?? join(homedir(), ".cache", "jacquard-tts", "hf"), HF_HUB_DISABLE_TELEMETRY: "1", TOKENIZERS_PARALLELISM: "false" };
const tmp = join("out", ".tmp", "tts");
mkdirSync(tmp, { recursive: true });

function run(command: "synth" | "asr", payload: unknown): void {
  const file = join(tmp, `${command}.json`);
  writeFileSync(file, JSON.stringify(payload));
  const result = spawnSync(python, [join("voice", "tts", "tts.py"), command, file], { env, stdio: ["ignore", "inherit", "pipe"] });
  if (result.status !== 0) {
    console.error(result.stderr.toString().slice(-3000));
    process.exit(1);
  }
}

/** Seconds of speech in a file, after the same trimming the voice assembly does. */
function speechSeconds(file: string): number {
  const bytes = execFileSync("ffmpeg", ["-v", "error", "-i", file, "-f", "f32le", "-ac", "1", "-ar", String(VOICE_RATE), "pipe:1"], { maxBuffer: 1 << 30 });
  const copy = new Uint8Array(bytes.length - (bytes.length % 4));
  copy.set(bytes.subarray(0, copy.length));
  const bounds = trimBounds(new Float32Array(copy.buffer), VOICE_RATE);
  return bounds === null ? 0 : (bounds.end - bounds.start) / VOICE_RATE;
}

interface Job {
  readonly line: VoiceLine;
  readonly voice: string;
  readonly out: string;
  speed: number;
  seed: number;
}

const job = (line: VoiceLine, name: string, out: string, speed: number, seed: number) => ({ out, voice: name, speed, seed, pause: SENTENCE_PAUSE, sentences: speechSentences(line.text, line.number) });

const lines = voiceLines();
const chosen = samples ? lines.filter((line) => SAMPLE_LINES.includes(line.number)) : lines.filter((line) => only === undefined || only.includes(line.number));
const jobs: Job[] = samples
  ? SAMPLE_VOICES.flatMap((name) => chosen.map((line) => ({ line, voice: name, out: join("out", "voice-samples", name, line.file), speed: BASE_SPEED, seed: lineSeed(line.number) })))
  : chosen.map((line) => ({ line, voice, out: join("voice", "lines", line.file), speed: BASE_SPEED, seed: lineSeed(line.number) }));

// 1. Natural pace.
run("synth", { jobs: jobs.map((item) => job(item.line, item.voice, item.out, item.speed, item.seed)) });
// 2. Each line again at the speed that makes it fill about 88 % of its window (85 to 95 %, speed
// 0.8 to 1.05), up to three more takes, since speech time is only roughly 1 / speed. Samples stay
// at speed 1.
if (!samples) {
  for (let pass = 1; pass <= 3; pass += 1) {
    const again = jobs.filter((item) => {
      const speech = speechSeconds(item.out);
      const speed = chooseSpeed(speech, item.line.window, item.speed);
      if (speed === item.speed) return false;
      console.log(`${item.line.name}: ${speech.toFixed(2)} s (${Math.round((wordCount(item.line.text) / speech) * 60)} wpm, ${Math.round((speech / item.line.window) * 100)} % of ${item.line.window.toFixed(2)} s) at speed ${item.speed}; again at ${speed}`);
      item.speed = speed;
      return true;
    });
    if (again.length === 0) break;
    run("synth", { jobs: again.map((item) => job(item.line, item.voice, item.out, item.speed, item.seed)) });
  }
}
// 3. Transcribe and compare (checkLine: the whole line, or each sentence on its own). A line that
// fails is made again, with new seeds at the same speed and then at nearby speeds, until a take
// passes; the passing take is kept, or the first one if none does.
const asrOut = join(tmp, "asr-out.json");
const transcribe = (files: readonly (string | { file: string; from: number; to: number })[]): string[] => {
  run("asr", { files, out: asrOut });
  return (JSON.parse(readFileSync(asrOut, "utf8")) as { transcript: string }[]).map((row) => row.transcript);
};
/** Each sentence's range in a take, from its sidecar, with 0.1 s either side. */
const sentenceRanges = (file: string): { file: string; from: number; to: number }[] => {
  const side = JSON.parse(readFileSync(file.replace(/\.wav$/, ".json"), "utf8")) as { rate: number; sentences: { start: number; end: number }[] };
  return side.sentences.map((range) => ({ file, from: Math.max(0, range.start / side.rate - 0.1), to: range.end / side.rate + 0.1 }));
};
const checkTake = (line: VoiceLine, file: string, whole: string) => {
  let check = checkLine(line.text, whole);
  let sentences: string[] | undefined;
  if (!check.match && splitSentences(line.text).length > 1) {
    sentences = transcribe(sentenceRanges(file));
    check = checkLine(line.text, whole, sentences);
  }
  return { check, sentences };
};
const transcripts = transcribe(jobs.map((item) => item.out));
const results = jobs.map((item, index) => checkTake(item.line, item.out, transcripts[index]!));
const attempts = new Map<Job, string[]>();
if (!samples) {
  for (const [index, item] of jobs.entries()) {
    if (results[index]!.check.match) continue;
    const tried = [`speed ${item.speed} seed ${item.seed}`];
    for (const { speed, seed } of retryTakes(item.line.number, item.speed)) {
      const trial = job(item.line, item.voice, join(tmp, `retry-${item.line.file}`), speed, seed);
      run("synth", { jobs: [trial] });
      if (speechSeconds(trial.out) > item.line.window * 1.05) continue;
      tried.push(`speed ${speed} seed ${seed}`);
      const [heard] = transcribe([trial.out]);
      const result = checkTake(item.line, trial.out, heard!);
      console.log(`${item.line.name}: again at speed ${speed}, seed ${seed}: "${heard}"${result.sentences ? ` / by sentence: ${result.sentences.map((text) => `"${text}"`).join(" ")}` : ""}`);
      if (result.check.match) {
        execFileSync("cp", [trial.out, item.out]);
        execFileSync("cp", [trial.out.replace(/\.wav$/, ".json"), item.out.replace(/\.wav$/, ".json")]);
        item.speed = speed;
        item.seed = seed;
        transcripts[index] = heard!;
        results[index] = result;
        break;
      }
    }
    attempts.set(item, tried);
  }
}
const report = jobs.map((item, index) => {
  const transcript = transcripts[index]!;
  const { check, sentences } = results[index]!;
  const speech = speechSeconds(item.out);
  return {
    line: item.line.name,
    voice: item.voice,
    speed: item.speed,
    seed: item.seed,
    speech: Number(speech.toFixed(2)),
    window: Number(item.line.window.toFixed(2)),
    wpm: Math.round((wordCount(item.line.text) / speech) * 60),
    fits: speech <= item.line.window,
    fill: Number((speech / item.line.window).toFixed(3)),
    fillsWindow: fills(speech, item.line.window),
    match: check.match,
    by: check.by,
    script: item.line.text,
    transcript,
    sentenceTranscripts: sentences ?? null,
    missing: check.missing,
    extra: check.extra,
    sameSound: check.sameSound,
    takes: attempts.get(item) ?? [`speed ${item.speed} seed ${item.seed}`],
  };
});
// 4. Word times of each kept take (for cutting the Vertical_Cut on a phrase, 9.9), into its sidecar.
if (!samples) {
  run("asr", { files: jobs.map((item) => item.out), out: asrOut, words: true });
  const timed = JSON.parse(readFileSync(asrOut, "utf8")) as { words: { word: string; start: number; end: number }[] }[];
  jobs.forEach((item, index) => {
    const side = item.out.replace(/\.wav$/, ".json");
    writeFileSync(side, JSON.stringify({ ...(JSON.parse(readFileSync(side, "utf8")) as object), words: timed[index]!.words }, null, 1));
  });
}
const reportFile = samples ? join("out", "voice-samples", "report.json") : join("out", "tts-report.json");
mkdirSync(join("out", samples ? "voice-samples" : ""), { recursive: true });
// With --only, the other lines' rows are kept from the last full run.
const previous = only !== undefined && existsSync(reportFile) ? (JSON.parse(readFileSync(reportFile, "utf8")) as typeof report) : [];
const merged = [...previous.filter((row) => !report.some((item) => item.line === row.line)), ...report].sort((a, b) => a.line.localeCompare(b.line));
writeFileSync(reportFile, JSON.stringify(merged, null, 1));
for (const row of report) {
  console.log(`${row.voice} ${row.line}: ${row.match ? `transcript matches${row.by === "sentences" ? " sentence by sentence" : ""}${row.sameSound.length > 0 ? ` (same sound: ${row.sameSound.join(", ")})` : ""}` : `TRANSCRIPT DIFFERS (missing: ${row.missing.join(" ")}; extra: ${row.extra.join(" ")})`} · ${row.speech} s in ${row.window} s (${Math.round(row.fill * 100)} %${row.fillsWindow ? "" : ", outside 85 to 95 %"}) · speed ${row.speed} · ${row.wpm} wpm`);
}
const bad = merged.filter((row) => !row.match);
console.log(`${reportFile}: ${merged.length - bad.length} of ${merged.length} transcripts match`);
if (bad.length > 0) process.exit(1);
