import { spawn } from "node:child_process";
import crypto from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import {
  FILE_MAX_BYTES,
  FILE_WARN_BYTES,
  PHOTO_EXTENSIONS,
  PHOTO_WIDTHS,
  POSTER_WIDTHS,
  PUBLIC_DIR,
  VIDEO_EXTENSIONS,
  VIDEO_SHORT_SIDE,
  WEBP_QUALITY,
  formatBytes,
} from "./config.mjs";
import { photoUrl, posterUrl, videoUrl } from "./manifest.mjs";

const MAX_LONG_EDGE = PHOTO_WIDTHS.at(-1);

export function mediaKind(file) {
  const ext = path.extname(file).toLowerCase();
  if (PHOTO_EXTENSIONS.has(ext)) return "photo";
  if (VIDEO_EXTENSIONS.has(ext)) return "video";
  return null;
}

/** Short content hash: the same file always gets the same id, so re-imports skip duplicates. */
export async function hashFile(file) {
  const hash = crypto.createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex").slice(0, 12);
}

export const hashText = (text) => crypto.createHash("sha256").update(text).digest("hex").slice(0, 12);

export function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", (error) =>
      reject(error.code === "ENOENT" ? new Error(`${command} is not installed`) : error),
    );
    child.on("close", (code) =>
      code === 0
        ? resolve({ stdout, stderr })
        : reject(new Error(`${command} exited with ${code}: ${stderr.trim().split("\n").slice(-3).join(" ")}`)),
    );
  });
}

const commandChecks = new Map();
export function commandExists(command, args = ["-version"]) {
  if (!commandChecks.has(command)) {
    commandChecks.set(command, run(command, args).then(() => true, () => false));
  }
  return commandChecks.get(command);
}

async function dominantColor(input) {
  const small = await sharp(input, { failOn: "none" }).autoOrient().resize(64, 64, { fit: "inside" }).toBuffer();
  const { dominant } = await sharp(small).stats();
  return `#${[dominant.r, dominant.g, dominant.b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/** sharp's bundled decoder can't read HEVC-based HEIC, so convert those first. */
async function decodablePhoto(input, tmpDir) {
  const ext = path.extname(input).toLowerCase();
  if (ext !== ".heic" && ext !== ".heif") return input;
  if (!(await commandExists("heif-convert", ["--version"]))) {
    throw new Error("HEIC photos need heif-convert (apt install libheif-examples), or save them as JPEG first");
  }
  const out = path.join(tmpDir, `${path.basename(input, ext)}-${crypto.randomUUID()}.png`);
  await run("heif-convert", [input, out]);
  return out;
}

function widthsFor(width, height, candidates = PHOTO_WIDTHS) {
  const largest = Math.min(width, Math.round((MAX_LONG_EDGE * width) / Math.max(width, height)));
  return [...new Set([...candidates.filter((w) => w < largest), largest])];
}

/**
 * Writes WebP variants of a photo. sharp drops EXIF, GPS, XMP, IPTC, and ICC data
 * unless asked to keep them; autoOrient() applies the EXIF rotation first.
 */
export async function processPhoto(input, id, { tmpDir }) {
  const source = await decodablePhoto(input, tmpDir);
  const meta = await sharp(source, { failOn: "none" }).metadata();
  const oriented = meta.autoOrient ?? { width: meta.width, height: meta.height };
  const widths = widthsFor(oriented.width, oriented.height);
  const width = widths.at(-1);
  const height = Math.round((oriented.height * width) / oriented.width);
  await fs.mkdir(path.dirname(path.join(PUBLIC_DIR, photoUrl(id, width))), { recursive: true });
  for (const w of widths) {
    await sharp(source, { failOn: "none" })
      .autoOrient()
      .resize({ width: w })
      .webp({ quality: WEBP_QUALITY, effort: 4 })
      .toFile(path.join(PUBLIC_DIR, photoUrl(id, w)));
  }
  return { id, width, height, widths, color: await dominantColor(source) };
}

async function writePoster(frame, id) {
  const meta = await sharp(frame).metadata();
  const widths = widthsFor(meta.width, meta.height, POSTER_WIDTHS).filter((w) => w <= POSTER_WIDTHS.at(-1));
  if (widths.length === 0) widths.push(Math.min(meta.width, POSTER_WIDTHS.at(-1)));
  await fs.mkdir(path.dirname(path.join(PUBLIC_DIR, posterUrl(id, widths[0]))), { recursive: true });
  for (const w of widths) {
    await sharp(frame)
      .resize({ width: w })
      .webp({ quality: WEBP_QUALITY, effort: 4 })
      .toFile(path.join(PUBLIC_DIR, posterUrl(id, w)));
  }
  return { widths, color: await dominantColor(frame) };
}

export async function probe(input) {
  const { stdout } = await run("ffprobe", [
    "-v", "error", "-print_format", "json", "-show_format", "-show_streams", input,
  ]);
  const info = JSON.parse(stdout);
  const video = info.streams.find((s) => s.codec_type === "video" && !s.disposition?.attached_pic);
  if (!video) throw new Error("no video stream found");
  const rotation = Number(
    video.side_data_list?.find((d) => d.rotation !== undefined)?.rotation ?? video.tags?.rotate ?? 0,
  );
  const sideways = Math.abs(rotation) % 180 === 90;
  return {
    width: sideways ? video.height : video.width,
    height: sideways ? video.width : video.height,
    duration: Number(info.format?.duration ?? video.duration ?? 0),
    hasAudio: info.streams.some((s) => s.codec_type === "audio"),
    hdr: ["arib-std-b67", "smpte2084"].includes(video.color_transfer),
    format: info.format,
    streams: info.streams,
  };
}

const ENCODE_ATTEMPTS = [
  { crf: 26, maxrate: 2500 },
  { crf: 30, maxrate: 1400 },
  { crf: 33, maxrate: 900 },
  { crf: 36, maxrate: 500 },
];

async function encodeVideo(input, out, meta, { crf, maxrate }) {
  const short = Math.min(meta.width, meta.height);
  const target = Math.min(VIDEO_SHORT_SIDE, short - (short % 2));
  const scale = meta.height > meta.width ? `scale=${target}:-2` : `scale=-2:${target}`;
  const filters = [scale];
  if (meta.hdr && (await hasFilter("zscale"))) {
    filters.unshift("zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv");
  }
  filters.push("format=yuv420p");
  await run("ffmpeg", [
    "-v", "error", "-y", "-i", input,
    "-map", "0:v:0", ...(meta.hasAudio ? ["-map", "0:a:0"] : []),
    // Drop all container and stream metadata (dates, device, GPS/location tags) and chapters.
    "-map_metadata", "-1", "-map_metadata:s:v", "-1", "-map_metadata:s:a", "-1", "-map_chapters", "-1",
    "-vf", filters.join(","),
    "-fpsmax", "30",
    "-c:v", "libx264", "-preset", "fast", "-profile:v", "high",
    "-crf", String(crf), "-maxrate", `${maxrate}k`, "-bufsize", `${maxrate * 2}k`,
    ...(meta.hasAudio ? ["-c:a", "aac", "-b:a", "128k", "-ac", "2"] : ["-an"]),
    "-movflags", "+faststart",
    "-fflags", "+bitexact", "-flags:v", "+bitexact", "-flags:a", "+bitexact",
    out,
  ]);
}

let filterList;
async function hasFilter(name) {
  filterList ??= run("ffmpeg", ["-hide_banner", "-filters"]).then((r) => r.stdout, () => "");
  return new RegExp(`\\s${name}\\s`).test(await filterList);
}

/** Compresses a video to ~720p H.264 with a poster frame; retries smaller if it is too big for GitHub. */
export async function processVideo(input, id, { tmpDir, log = console.log }) {
  const meta = await probe(input);
  const out = path.join(PUBLIC_DIR, videoUrl(id));
  await fs.mkdir(path.dirname(out), { recursive: true });
  let bytes = 0;
  for (const [i, attempt] of ENCODE_ATTEMPTS.entries()) {
    await encodeVideo(input, out, meta, attempt);
    bytes = (await fs.stat(out)).size;
    if (bytes <= FILE_WARN_BYTES) break;
    const last = i === ENCODE_ATTEMPTS.length - 1;
    if (last) {
      await fs.rm(out, { force: true });
      throw new Error(
        `still ${formatBytes(bytes)} after compression, over the 50 MB file limit. Upload it to YouTube or Vimeo (unlisted) and add the link instead.`,
      );
    }
  }
  const encoded = await probe(out);
  const frame = path.join(tmpDir, `${id}-poster.png`);
  const at = Math.min(1, encoded.duration / 3);
  await run("ffmpeg", ["-v", "error", "-y", "-ss", at.toFixed(2), "-i", out, "-frames:v", "1", frame]);
  return {
    id,
    kind: "file",
    width: encoded.width,
    height: encoded.height,
    duration: Math.round(encoded.duration * 10) / 10,
    bytes,
    poster: await writePoster(frame, id),
  };
}

export function parseVideoLink(link) {
  let url;
  try {
    url = new URL(link.trim());
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www|m)\./, "");
  if (host === "youtu.be") return { kind: "youtube", embedId: url.pathname.slice(1).split("/")[0] };
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (url.searchParams.get("v")) return { kind: "youtube", embedId: url.searchParams.get("v") };
    const match = url.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]+)/);
    if (match) return { kind: "youtube", embedId: match[1] };
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const match = url.pathname.match(/(?:\/video)?\/(\d+)(?:\/([\da-f]+))?/);
    if (match) {
      const hash = match[2] ?? url.searchParams.get("h") ?? undefined;
      return { kind: "vimeo", embedId: match[1], ...(hash ? { hash } : {}) };
    }
  }
  return null;
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { "User-Agent": "photonationx-site-media" } });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
}

async function download(url, file) {
  const response = await fetch(url);
  if (!response.ok) return false;
  await fs.writeFile(file, Buffer.from(await response.arrayBuffer()));
  return true;
}

/** Adds a YouTube or Vimeo video; the poster is stored locally so the page never contacts them until play. */
export async function processVideoLink(link, { tmpDir }) {
  const parsed = parseVideoLink(link);
  if (!parsed) throw new Error(`not a YouTube or Vimeo link: ${link}`);
  const id = hashText(`${parsed.kind}:${parsed.embedId}`);
  const thumb = path.join(tmpDir, `${id}-thumb.jpg`);
  let info;
  if (parsed.kind === "youtube") {
    info = await fetchJson(
      `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${parsed.embedId}`)}`,
    );
    const ok =
      (await download(`https://i.ytimg.com/vi/${parsed.embedId}/maxresdefault.jpg`, thumb)) ||
      (await download(info.thumbnail_url, thumb));
    if (!ok) throw new Error(`could not download the thumbnail for ${link}`);
  } else {
    const page = `https://vimeo.com/${parsed.embedId}${parsed.hash ? `/${parsed.hash}` : ""}`;
    info = await fetchJson(`https://vimeo.com/api/oembed.json?width=1280&url=${encodeURIComponent(page)}`);
    if (!(await download(info.thumbnail_url, thumb))) throw new Error(`could not download the thumbnail for ${link}`);
  }
  // YouTube's fallback thumbnails are letterboxed; trim the black bars.
  const trimmed = path.join(tmpDir, `${id}-thumb.png`);
  await sharp(thumb).trim({ background: "#000000", threshold: 20 }).png().toFile(trimmed);
  const frame = await sharp(trimmed).metadata();
  return {
    id,
    kind: parsed.kind,
    embedId: parsed.embedId,
    ...(parsed.hash ? { hash: parsed.hash } : {}),
    width: frame.width,
    height: frame.height,
    ...(info?.title ? { title: info.title } : {}),
    poster: await writePoster(trimmed, id),
  };
}
