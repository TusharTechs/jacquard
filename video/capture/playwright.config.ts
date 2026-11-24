// Capture of the live site (demo-video 3.1): headed Chromium so WebGL renders, 1920x1080.
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "*.spec.ts",
  timeout: 10 * 60 * 1000,
  retries: 0,
  workers: 1,
  reporter: "list",
  outputDir: "../test-results",
  use: {
    browserName: "chromium",
    headless: false,
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    acceptDownloads: true,
    launchOptions: {
      args: ["--autoplay-policy=no-user-gesture-required", "--window-size=1920,1180", "--hide-scrollbars", "--force-color-profile=srgb"],
    },
  },
});
