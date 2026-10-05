// Convert any full-range Remotion v4 exports to broadcast-standard Rec.709,
// retaining the original rendered master and copying the AAC track unchanged.
import { spawnSync } from "node:child_process";
import { readFile, mkdir, copyFile } from "node:fs/promises";
import path from "node:path";
const root = path.resolve("output");
const masters = path.join(root, "masters");
await mkdir(masters, { recursive: true });
const completed = JSON.parse(
  await readFile(path.join(root, "render-manifest.json"), "utf8"),
);
for (const name of completed.map((f) => f.file)) {
  const file = path.join(root, name);
  const probe = spawnSync(
    "ffprobe",
    [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=color_space,color_range,pix_fmt",
      "-of",
      "json",
      file,
    ],
    { encoding: "utf8", windowsHide: true },
  );
  if (probe.status !== 0) throw new Error(probe.stderr);
  const stream = JSON.parse(probe.stdout).streams[0];
  if (
    stream.color_space === "bt709" &&
    stream.color_range === "tv" &&
    stream.pix_fmt === "yuv420p"
  )
    continue;
  const source = path.join(masters, name);
  await copyFile(file, source);
  const result = spawnSync(
    "ffmpeg",
    [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      source,
      "-vf",
      "scale=in_range=pc:out_range=tv:in_color_matrix=bt601:out_color_matrix=bt709,format=yuv420p",
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      "16",
      "-color_primaries",
      "bt709",
      "-color_trc",
      "bt709",
      "-colorspace",
      "bt709",
      "-color_range",
      "tv",
      "-c:a",
      "copy",
      "-movflags",
      "+faststart",
      file,
    ],
    { encoding: "utf8", windowsHide: true },
  );
  if (result.status !== 0) throw new Error(result.stderr);
  console.log(`Final Rec.709 export: ${name}`);
}
