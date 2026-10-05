import http from "node:http";
import { stat, readFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
const root = path.resolve("output");
const port = 8871;
http
  .createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      const file = path.resolve(
        root,
        "." + (pathname === "/" ? "/index.html" : pathname),
      );
      if (!file.startsWith(root + path.sep)) {
        res.writeHead(403);
        res.end();
        return;
      }
      const info = await stat(file);
      const contentType = file.endsWith(".mp4")
        ? "video/mp4"
        : file.endsWith(".jpg")
          ? "image/jpeg"
          : file.endsWith(".png")
            ? "image/png"
            : file.endsWith(".json")
              ? "application/json"
              : "text/html; charset=utf-8";
      const range = req.headers.range;
      if (range) {
        const match = range.match(/bytes=(\d+)-(\d*)/);
        if (!match) {
          res.writeHead(416);
          res.end();
          return;
        }
        const start = Number(match[1]);
        const end = match[2]
          ? Math.min(Number(match[2]), info.size - 1)
          : info.size - 1;
        res.writeHead(206, {
          "Content-Type": contentType,
          "Content-Length": end - start + 1,
          "Content-Range": `bytes ${start}-${end}/${info.size}`,
          "Accept-Ranges": "bytes",
        });
        createReadStream(file, { start, end }).pipe(res);
      } else {
        res.writeHead(200, {
          "Content-Type": contentType,
          "Content-Length": info.size,
          "Accept-Ranges": "bytes",
        });
        createReadStream(file).pipe(res);
      }
    } catch {
      res.writeHead(404);
      res.end("File not found");
    }
  })
  .listen(port, "127.0.0.1", () =>
    console.log(`Looma completed films: http://localhost:${port}`),
  );
