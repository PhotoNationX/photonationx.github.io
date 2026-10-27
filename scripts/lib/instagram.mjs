import fs from "node:fs/promises";
import path from "node:path";
import { mediaKind } from "./media.mjs";
import { extractZip, listZip } from "./zip.mjs";

const INDEX_FILES = [
  { pattern: /^posts_\d+\.json$/i, source: "post" },
  { pattern: /^reels\.json$/i, source: "reel" },
  { pattern: /^igtv_videos\.json$/i, source: "igtv" },
  { pattern: /^stories\.json$/i, source: "story" },
];
const MEDIA_FOLDERS = ["posts", "reels", "igtv", "stories"];

const indexSource = (name) => INDEX_FILES.find((f) => f.pattern.test(path.basename(name)))?.source;

/** True for zip entries that belong to an Instagram export's posts, reels, IGTV, or stories. */
export function isInstagramEntry(name, { includeStories = false } = {}) {
  const source = indexSource(name);
  if (source) return includeStories || source !== "story";
  const folders = includeStories ? MEDIA_FOLDERS : MEDIA_FOLDERS.filter((f) => f !== "stories");
  return folders.some((folder) => new RegExp(`(^|/)media/${folder}/`).test(name)) && Boolean(mediaKind(name));
}

export async function looksLikeInstagramZip(file) {
  const names = await listZip(file);
  return names.some((name) => indexSource(name) || /(^|\/)media\/(posts|reels|igtv)\//.test(name));
}

/**
 * Unpacks only the posts/reels/IGTV indexes and their media from one or more
 * export zips into `destination`. Messages, contacts, and everything else stay
 * inside the zip.
 */
export async function extractInstagramZips(zips, destination, options) {
  for (const zip of zips) {
    await extractZip(zip, destination, (name) => isInstagramEntry(name, options));
  }
}

/** Instagram exports store UTF-8 text as Latin-1 code points ("cafÃ©" for "café"). */
export function fixText(value) {
  if (typeof value !== "string") return "";
  if (!/[\u0080-\u00ff]/.test(value) || /[^\u0000-\u00ff]/.test(value)) return value;
  const decoded = Buffer.from(value, "latin1").toString("utf8");
  return decoded.includes("\ufffd") ? value : decoded;
}

async function* walk(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

function entriesFromIndex(json, source) {
  const entries = [];
  const add = (media, caption, timestamp) => {
    for (const item of media ?? []) {
      if (typeof item?.uri !== "string" || /^https?:/i.test(item.uri)) continue;
      entries.push({
        uri: item.uri,
        source,
        timestamp: Number(item.creation_timestamp ?? timestamp ?? 0),
        caption: fixText(item.title || caption || "").trim(),
      });
    }
  };
  if (Array.isArray(json)) {
    for (const post of json) add(post?.media, post?.title, post?.creation_timestamp);
  } else if (json && typeof json === "object") {
    for (const list of Object.values(json)) {
      if (!Array.isArray(list)) continue;
      for (const item of list) {
        if (Array.isArray(item?.media)) add(item.media, item.title, item.creation_timestamp);
        else add([item]);
      }
    }
  }
  return entries;
}

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

/** Media URIs are relative to the export root, which may sit above the folder that was passed in. */
async function resolveUri(root, indexFile, uri) {
  const candidates = [path.join(root, uri)];
  for (let dir = path.dirname(indexFile); dir.startsWith(root); dir = path.dirname(dir)) {
    candidates.push(path.join(dir, uri));
    if (dir === path.dirname(dir)) break;
  }
  for (const candidate of candidates) if (await exists(candidate)) return candidate;
  return null;
}

/**
 * Reads an unpacked Instagram "Download your information" export (JSON format)
 * and returns its media, newest first, with captions and post timestamps.
 */
export async function readInstagramExport(root, { includeStories = false } = {}) {
  root = path.resolve(root);
  const indexFiles = [];
  let htmlExport = false;
  for await (const file of walk(root)) {
    const source = indexSource(file);
    if (source && (includeStories || source !== "story")) indexFiles.push({ file, source });
    if (/^posts_\d+\.html$/i.test(path.basename(file))) htmlExport = true;
  }
  if (indexFiles.length === 0) {
    throw new Error(
      htmlExport
        ? "This export is in HTML format. Request a new export from Instagram and choose JSON format."
        : "No posts_1.json, reels.json, or igtv_videos.json found. Is this an Instagram export?",
    );
  }

  const items = [];
  const missing = [];
  const seen = new Set();
  for (const { file, source } of indexFiles) {
    const json = JSON.parse(await fs.readFile(file, "utf8"));
    for (const entry of entriesFromIndex(json, source)) {
      const kind = mediaKind(entry.uri);
      if (!kind) continue;
      const resolved = await resolveUri(root, file, entry.uri);
      if (!resolved) {
        missing.push(entry.uri);
        continue;
      }
      if (seen.has(resolved)) continue;
      seen.add(resolved);
      items.push({ ...entry, kind, file: resolved });
    }
  }
  // Stable sort keeps carousel order inside a post.
  items.sort((a, b) => b.timestamp - a.timestamp);
  return { items, missing };
}
