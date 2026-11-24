// CDP screencast to timestamped JPEG frames (demo-video design, "Capture").
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { CDPSession, Page } from "@playwright/test";

export interface Screencast {
  stop: () => Promise<{ frames: { file: string; time: number }[] }>;
}

export async function startScreencast(page: Page, dir: string): Promise<Screencast> {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const session: CDPSession = await page.context().newCDPSession(page);
  const frames: { file: string; time: number }[] = [];
  session.on("Page.screencastFrame", (event) => {
    const file = `f${String(frames.length).padStart(6, "0")}.jpg`;
    writeFileSync(join(dir, file), Buffer.from(event.data, "base64"));
    frames.push({ file, time: event.metadata.timestamp ?? Date.now() / 1000 });
    void session.send("Page.screencastFrameAck", { sessionId: event.sessionId }).catch(() => undefined);
  });
  await session.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
  return {
    stop: async () => {
      await session.send("Page.stopScreencast");
      await session.detach().catch(() => undefined);
      return { frames };
    },
  };
}
