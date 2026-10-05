import { bundle } from "@remotion/bundler";
import { selectComposition, renderStill } from "@remotion/renderer";
import { mkdir } from "node:fs/promises";
import path from "node:path";
const browserExecutable =
  process.env.LOOMA_CHROME ||
  "C:/Users/marti/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe";
await mkdir("output/qa", { recursive: true });
const serveUrl = await bundle({
  entryPoint: path.resolve("src/index.ts"),
  rspack: true,
});
const targets = [
  ["Looma-Meet", 85],
  ["Looma-Meet", 220],
  ["Looma-Meet", 1010],
  ["Looma-Opportunities", 510],
  ["Looma-Presence", 280],
  ["Looma-Presence", 690],
  ["Looma-Meet-Vertical", 85],
  ["Looma-Meet-Vertical", 220],
  ["Looma-Meet-Vertical", 1010],
  ["Looma-Opportunities-Vertical", 510],
  ["Looma-Presence-Vertical", 280],
  ["Looma-Presence-Vertical", 690],
];
for (const [id, frame] of targets) {
  const composition = await selectComposition({
    serveUrl,
    id,
    browserExecutable,
  });
  await renderStill({
    serveUrl,
    composition,
    browserExecutable,
    frame,
    imageFormat: "png",
    output: path.resolve("output/qa", `${id}-${frame}.png`),
    overwrite: true,
  });
  console.log(`QA still: ${id} / ${frame}`);
}
