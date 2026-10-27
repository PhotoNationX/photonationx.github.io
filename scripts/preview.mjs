#!/usr/bin/env node
/**
 * Serves the static build in out/ the way GitHub Pages does, optionally under a
 * base path:  node scripts/preview.mjs --port 4318 --base /my-repo
 */
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { parseArgs } from "node:util";
import { ROOT } from "./lib/config.mjs";

const { values } = parseArgs({
  options: {
    port: { type: "string", default: "4318" },
    base: { type: "string", default: process.env.NEXT_PUBLIC_BASE_PATH ?? "" },
    dir: { type: "string", default: "out" },
  },
});
const root = path.resolve(ROOT, values.dir);
const base = values.base.replace(/\/$/, "");
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".txt": "text/plain; charset=utf-8", ".xml": "application/xml", ".svg": "image/svg+xml", ".png": "image/png",
  ".jpg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon", ".mp4": "video/mp4",
  ".woff2": "font/woff2", ".webmanifest": "application/manifest+json",
};

async function resolveFile(urlPath) {
  const clean = path.normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, "");
  const candidates = clean.endsWith("/")
    ? [path.join(root, clean, "index.html")]
    : [path.join(root, clean), path.join(root, `${clean}.html`), path.join(root, clean, "index.html")];
  for (const file of candidates) {
    if (!file.startsWith(root)) continue;
    const stat = await fs.stat(file).catch(() => null);
    if (stat?.isFile()) return { file, stat };
  }
  return null;
}

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (base && url.pathname === base) {
      res.writeHead(301, { Location: `${base}/` }).end();
      return;
    }
    if (base && !url.pathname.startsWith(`${base}/`)) {
      res.writeHead(404).end("Not found (outside the base path)");
      return;
    }
    const found = await resolveFile(url.pathname.slice(base.length) || "/");
    if (!found) {
      const notFound = path.join(root, "404.html");
      res.writeHead(404, { "Content-Type": TYPES[".html"] });
      createReadStream(notFound).on("error", () => res.end("Not found")).pipe(res);
      return;
    }
    const type = TYPES[path.extname(found.file)] ?? "application/octet-stream";
    const range = req.headers.range?.match(/bytes=(\d*)-(\d*)/);
    if (range) {
      const start = range[1] ? Number(range[1]) : 0;
      const end = range[2] ? Number(range[2]) : found.stat.size - 1;
      res.writeHead(206, {
        "Content-Type": type,
        "Content-Range": `bytes ${start}-${end}/${found.stat.size}`,
        "Accept-Ranges": "bytes",
        "Content-Length": end - start + 1,
      });
      createReadStream(found.file, { start, end }).pipe(res);
      return;
    }
    res.writeHead(200, { "Content-Type": type, "Content-Length": found.stat.size, "Accept-Ranges": "bytes" });
    createReadStream(found.file).pipe(res);
  })
  .listen(Number(values.port), () => {
    console.log(`Serving ${path.relative(ROOT, root)}/ at http://localhost:${values.port}${base}/`);
  });
