import { bundle } from "@remotion/bundler";
import { selectComposition, renderMedia } from "@remotion/renderer";
import { mkdir, writeFile, stat } from "node:fs/promises";
import path from "node:path";

await mkdir("output", { recursive: true });
const browserExecutable =
  process.env.LOOMA_CHROME ||
  "C:/Users/marti/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe";
console.log("Bundling editable Looma film project…");
const serveUrl = await bundle({
  entryPoint: path.resolve("src/index.ts"),
  rspack: true,
});
const films = [
  ["Looma-Meet", "looma-meet.mp4"],
  ["Looma-Opportunities", "looma-opportunities.mp4"],
  ["Looma-Presence", "looma-presence.mp4"],
  ["Looma-Meet-Vertical", "looma-meet-vertical.mp4"],
  ["Looma-Opportunities-Vertical", "looma-opportunities-vertical.mp4"],
  ["Looma-Presence-Vertical", "looma-presence-vertical.mp4"],
];
const records = [];
for (const [id, name] of films) {
  if (process.argv[2] && !id.includes(process.argv[2])) continue;
  const outputLocation = path.resolve("output", name);
  const composition = await selectComposition({
    serveUrl,
    id,
    browserExecutable,
  });
  let progress = -1;
  console.log(
    `Rendering ${name} (${composition.durationInFrames / composition.fps}s)…`,
  );
  await renderMedia({
    serveUrl,
    composition,
    outputLocation,
    browserExecutable,
    codec: "h264",
    crf: 17,
    pixelFormat: "yuv420p",
    colorSpace: "bt709",
    audioCodec: "aac",
    audioBitrate: "256k",
    sampleRate: 48000,
    imageFormat: "jpeg",
    jpegQuality: 95,
    concurrency: 4,
    x264Preset: "medium",
    overwrite: true,
    onProgress: ({ progress: p }) => {
      const step = Math.floor(p * 10);
      if (step > progress) {
        progress = step;
        console.log(`${name}: ${step * 10}%`);
      }
    },
  });
  records.push({
    file: name,
    path: outputLocation,
    duration: composition.durationInFrames / composition.fps,
    fps: composition.fps,
    width: composition.width,
    height: composition.height,
    bytes: (await stat(outputLocation)).size,
  });
  await writeFile(
    "output/render-manifest.json",
    JSON.stringify(records, null, 2),
  );
  console.log(`Finished: ${name}`);
}
