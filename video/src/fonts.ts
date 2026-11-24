// The app's three typefaces, self-hosted from Fontsource (demo-video 6.1). The render waits until
// each one is loaded, so no frame uses a fallback font.
import "@fontsource-variable/fraunces";
import "@fontsource-variable/instrument-sans";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import { continueRender, delayRender } from "remotion";

let started = false;

export function waitForFonts(): void {
  if (started) return;
  started = true;
  const handle = delayRender("fonts");
  const faces = ['600 64px "Fraunces Variable"', '400 40px "Instrument Sans Variable"', '600 40px "Instrument Sans Variable"', '400 26px "IBM Plex Mono"', '500 26px "IBM Plex Mono"'];
  void Promise.all(faces.map((face) => document.fonts.load(face))).then(() => continueRender(handle));
}
