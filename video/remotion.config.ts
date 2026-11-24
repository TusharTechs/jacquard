// Remotion render settings for the demo video (demo-video design, "Remotion").
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(92);
Config.setConcurrency(4);
Config.setPublicDir("public");
