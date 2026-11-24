// One storyboard still per scene (demo-video 7.1): out/storyboard/<n>-<scene>.png, each at the
// frame that shows the scene's main idea.
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { SCENES } from "../src/script.ts";

/** Seconds into the Main_Cut for each scene's still. */
const AT: Readonly<Record<string, number>> = { problem: 17.5, solution: 63, kiro: 111, close: 166 };
mkdirSync("out/storyboard", { recursive: true });
SCENES.forEach((scene, index) => {
  const frame = Math.round((AT[scene.id] ?? scene.start + 1) * 30);
  const file = `out/storyboard/${index + 1}-${scene.id}.png`;
  execFileSync("npx", ["remotion", "still", "src/index.ts", "Main", file, `--frame=${frame}`, "--log=error"], { stdio: "inherit" });
  console.log(file);
});
