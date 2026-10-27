#!/usr/bin/env node
/**
 * Fills the galleries with clearly labelled sample content so the site can be
 * built and reviewed before the real Instagram export arrives. It writes a small
 * fake export (with test EXIF/GPS and video location tags that the pipeline must
 * strip) and runs the normal importer on it. Real imports remove the samples.
 */
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { PUBLIC_DIR } from "./lib/config.mjs";
import { importInstagramItems, pruneMedia, withTempDir } from "./lib/importer.mjs";
import { readInstagramExport } from "./lib/instagram.mjs";
import { readManifest, readSite, removeSamples, writeManifest } from "./lib/manifest.mjs";
import { run } from "./lib/media.mjs";

const PALETTES = [
  ["#f9d5c3", "#fbe9df", "#fff4e0", ["#c9a6b9", "#9a7a9e", "#6b5280", "#3f2f58"]],
  ["#a9d4f5", "#e5f2fc", "#ffffff", ["#7fb0d8", "#4f86b8", "#2b5d8f", "#173a63"]],
  ["#f6c27a", "#fbe3b4", "#fff7e6", ["#e0a060", "#c27c43", "#9a5a2e", "#6b3b1e"]],
  ["#cfe3d4", "#eef6ef", "#ffffff", ["#9cc3a5", "#6f9c7c", "#467556", "#274d36"]],
  ["#f28c6b", "#6c4f8f", "#ffd27f", ["#5b3f73", "#43305a", "#2d2141", "#1a1329"]],
  ["#1b2a4a", "#3b4f7a", "#f4f1de", ["#2c3b5c", "#22304c", "#18233a", "#0e1626"]],
  ["#f7c6d0", "#fdeef1", "#ffffff", ["#e59aae", "#c76f8b", "#9b4b68", "#6a2f47"]],
  ["#d6ecf7", "#f4fafd", "#ffffff", ["#b3d4e6", "#88b4cf", "#5e8fae", "#3a6886"]],
];
const SIZES = [[1080, 1350], [1080, 1080], [1080, 1350], [1080, 720], [1080, 1350], [1080, 1080], [1440, 1800], [1080, 566]];
const VIDEOS = [
  { size: "1080x1920", colors: ["0xf9d5c3", "0x6c4f8f", "0x0054fc", "0xff3b3b"] },
  { size: "1920x1080", colors: ["0x1b2a4a", "0x0054fc", "0xc4e2fc", "0x2b5d8f"] },
  { size: "1080x1080", colors: ["0xf6c27a", "0xe60000", "0x6c4f8f", "0xfbe3b4"] },
  { size: "1080x1920", colors: ["0xcfe3d4", "0x467556", "0xc4e2fc", "0x0054fc"] },
];
const PHOTO_COUNT = 16;

function random(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function landscape(width, height, seed) {
  const rand = random(seed);
  const [skyTop, skyBottom, sun, layers] = PALETTES[seed % PALETTES.length];
  const sunX = width * (0.2 + rand() * 0.6);
  const sunY = height * (0.2 + rand() * 0.18);
  const sunR = Math.min(width, height) * (0.05 + rand() * 0.05);
  const ridges = layers
    .map((color, i) => {
      const base = height * (0.5 + i * 0.12);
      const amplitude = height * (0.2 - i * 0.035);
      const steps = 6 + Math.floor(rand() * 6);
      const points = Array.from({ length: steps + 1 }, (_, s) => `${((width * s) / steps).toFixed(1)},${(base - rand() * amplitude).toFixed(1)}`);
      return `<path d="M0,${height} L${points.join(" L")} L${width},${height} Z" fill="${color}"/>`;
    })
    .join("");
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${skyTop}"/><stop offset="1" stop-color="${skyBottom}"/></linearGradient>
      <filter id="glow"><feGaussianBlur stdDeviation="${(sunR * 0.8).toFixed(1)}"/></filter>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#sky)"/>
    <circle cx="${sunX}" cy="${sunY}" r="${sunR * 1.9}" fill="${sun}" opacity="0.45" filter="url(#glow)"/>
    <circle cx="${sunX}" cy="${sunY}" r="${sunR}" fill="${sun}"/>
    ${ridges}
    <text x="${width - 28}" y="${height - 28}" text-anchor="end" font-family="DejaVu Sans, Arial, sans-serif" font-size="${Math.round(width * 0.024)}" letter-spacing="4" fill="#ffffff" fill-opacity="0.8">SAMPLE</text>
  </svg>`);
}

/** Text the way Instagram exports it: UTF-8 bytes as Latin-1 code points. */
const mangle = (text) => Buffer.from(text, "utf8").toString("latin1");

async function writeFakeExport(root) {
  const posts = [];
  const start = Date.UTC(2026, 8, 30) / 1000;
  let n = 0;
  for (let i = 0; i < PHOTO_COUNT; ) {
    const carousel = i === 3 ? 3 : 1;
    const timestamp = start - n * 9 * 86400;
    const month = new Date(timestamp * 1000).toISOString().slice(0, 7).replace("-", "");
    const media = [];
    for (let j = 0; j < carousel && i < PHOTO_COUNT; j++, i++) {
      const [width, height] = SIZES[i % SIZES.length];
      const uri = `media/posts/${month}/179${String(i).padStart(14, "0")}.jpg`;
      await fs.mkdir(path.join(root, path.dirname(uri)), { recursive: true });
      await sharp(landscape(width, height, i + 1))
        .jpeg({ quality: 90 })
        .withExif({
          IFD0: { Make: "SampleCam", Model: "Sample 1", Artist: "Sample Artist", Copyright: "Sample" },
          IFD3: { GPSLatitudeRef: "N", GPSLatitude: "25/1 46/1 0/1", GPSLongitudeRef: "W", GPSLongitude: "80/1 11/1 0/1" },
        })
        .toFile(path.join(root, uri));
      media.push({ uri, creation_timestamp: timestamp, title: carousel > 1 ? "" : mangle(`Sample caption ${i + 1} — café at golden hour`) });
    }
    posts.push(carousel > 1 ? { media, title: mangle("Sample carousel — three frames"), creation_timestamp: timestamp } : { media });
    n++;
  }

  const reels = [];
  for (const [i, video] of VIDEOS.entries()) {
    const timestamp = start - (i * 13 + 4) * 86400;
    const month = new Date(timestamp * 1000).toISOString().slice(0, 7).replace("-", "");
    const uri = `media/reels/${month}/180${String(i).padStart(14, "0")}.mp4`;
    await fs.mkdir(path.join(root, path.dirname(uri)), { recursive: true });
    const [c0, c1, c2, c3] = video.colors;
    const short = Math.min(...video.size.split("x").map(Number));
    await run("ffmpeg", [
      "-v", "error", "-y",
      "-f", "lavfi", "-i", `gradients=s=${video.size}:r=30:d=6:n=4:c0=${c0}:c1=${c1}:c2=${c2}:c3=${c3}:speed=0.03:seed=${i + 7}`,
      "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo",
      "-vf", `drawtext=text='SAMPLE VIDEO':fontcolor=white@0.85:fontsize=${Math.round(short * 0.06)}:x=(w-text_w)/2:y=(h-text_h)/2`,
      "-shortest", "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac",
      "-metadata", "location=+25.7617-080.1918/", "-metadata", "artist=Sample Artist",
      "-metadata", "creation_time=2026-06-01T12:00:00Z", "-metadata:s:v:0", "handler_name=Sample Camera",
      path.join(root, uri),
    ]);
    reels.push({ media: [{ uri, creation_timestamp: timestamp, title: mangle(`Sample reel ${i + 1} — motion test`) }] });
  }

  const content = path.join(root, "your_instagram_activity", "content");
  await fs.mkdir(content, { recursive: true });
  await fs.writeFile(path.join(content, "posts_1.json"), JSON.stringify(posts, null, 2));
  await fs.writeFile(path.join(content, "reels.json"), JSON.stringify({ ig_reels_media: reels }, null, 2));
  await fs.writeFile(
    path.join(content, "stories.json"),
    JSON.stringify({ ig_stories: [{ uri: "media/stories/202609/1.jpg", creation_timestamp: start, title: "skipped by default" }] }),
  );
}

const manifest = await readManifest();
const real = [...manifest.photos, ...manifest.videos].filter((e) => !e.sample).length;
if (real > 0 && !process.argv.includes("--force")) {
  console.error(`The site already has ${real} real item(s); samples are only for an empty site. Use --force to add them anyway.`);
  process.exit(1);
}

await withTempDir(async (tmpDir) => {
  const root = path.join(tmpDir, "export");
  console.log("Writing a fake Instagram export with sample photos and videos...");
  await writeFakeExport(root);
  const { items } = await readInstagramExport(root);
  await removeSamples(manifest);
  const site = await readSite();
  const result = await importInstagramItems(manifest, items, {
    tmpDir,
    display: site.display,
    sample: true,
    log: (m) => console.log(m),
  });
  await pruneMedia(PUBLIC_DIR, manifest, { includeHidden: true });
  await writeManifest(manifest);
  console.log(`Sample content ready: ${manifest.photos.length} photos, ${manifest.videos.length} videos (${result.failed.length} failed).`);
});
