import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  PRIVATE_DIR,
  PUBLIC_DIR,
  SITE_MAX_BYTES,
  SITE_WARN_BYTES,
  formatBytes,
} from "./config.mjs";
import { photoFiles, videoFiles } from "./manifest.mjs";
import { hashFile, mediaKind, processPhoto, processVideo, processVideoLink } from "./media.mjs";

export async function withTempDir(fn) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "photonationx-"));
  try {
    return await fn(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

export async function* walkFiles(dir) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name.startsWith(".") || entry.name === "__MACOSX") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walkFiles(full);
    else yield full;
  }
}

const isoDate = (seconds) => new Date(seconds * 1000).toISOString().slice(0, 10);

/**
 * Adds Instagram export items (from readInstagramExport) to the manifest. The
 * Instagram section is rebuilt in export order, newest first, after any newer
 * uploads. Captions and dates are written only when site.json shows them.
 */
export async function importInstagramItems(manifest, items, { tmpDir, display = {}, category, sample = false, log }) {
  const known = new Map([...manifest.photos, ...manifest.videos].map((e) => [e.id, e]));
  const photos = [];
  const videos = [];
  const text = {};
  const failed = [];
  let added = 0;
  let reused = 0;

  for (const [i, item] of items.entries()) {
    const label = `[${i + 1}/${items.length}] ${path.basename(item.file)}`;
    try {
      const id = await hashFile(item.file);
      let entry = known.get(id);
      if (entry) {
        reused++;
      } else {
        log(`${label} (${item.kind})`);
        entry =
          item.kind === "photo"
            ? await processPhoto(item.file, id, { tmpDir })
            : await processVideo(item.file, id, { tmpDir, log });
        added++;
      }
      entry = { ...entry, source: "instagram" };
      if (sample) entry.sample = true;
      if (category && item.kind === "photo") entry.category = category;
      const date = item.timestamp ? isoDate(item.timestamp) : undefined;
      if (display.captions && item.caption) entry.caption = item.caption;
      else delete entry.caption;
      if (display.dates && date) entry.date = date;
      else delete entry.date;
      if (!sample) text[id] = { caption: item.caption, date };
      (item.kind === "photo" ? photos : videos).push(entry);
      known.set(id, entry);
    } catch (error) {
      failed.push({ file: path.basename(item.file), error: error.message });
      log(`${label} failed: ${error.message}`);
    }
  }

  const imported = new Set([...photos, ...videos].map((e) => e.id));
  const merge = (current, fresh) => [
    ...current.filter((e) => e.source !== "instagram" && !imported.has(e.id)),
    ...fresh,
    ...current.filter((e) => e.source === "instagram" && !imported.has(e.id)),
  ];
  manifest.photos = merge(manifest.photos, photos);
  manifest.videos = merge(manifest.videos, videos);
  return { added, reused, failed, text };
}

/** Adds loose photo and video files to the top of the galleries. */
export async function addFiles(manifest, files, { tmpDir, category, log }) {
  const known = new Set([...manifest.photos, ...manifest.videos].map((e) => e.id));
  const photos = [];
  const videos = [];
  const failed = [];
  let skipped = 0;
  for (const [i, file] of files.entries()) {
    const kind = mediaKind(file);
    const label = `[${i + 1}/${files.length}] ${path.basename(file)}`;
    if (!kind) {
      log(`${label} skipped: not a photo or video`);
      continue;
    }
    try {
      const id = await hashFile(file);
      if (known.has(id)) {
        skipped++;
        log(`${label} skipped: already on the site`);
        continue;
      }
      log(`${label} (${kind})`);
      const entry =
        kind === "photo"
          ? await processPhoto(file, id, { tmpDir })
          : await processVideo(file, id, { tmpDir, log });
      entry.source = "upload";
      if (category && kind === "photo") entry.category = category;
      (kind === "photo" ? photos : videos).push(entry);
      known.add(id);
    } catch (error) {
      failed.push({ file: path.basename(file), error: error.message });
      log(`${label} failed: ${error.message}`);
    }
  }
  manifest.photos = [...photos, ...manifest.photos];
  manifest.videos = [...videos, ...manifest.videos];
  return { added: photos.length + videos.length, skipped, failed };
}

/** Adds YouTube or Vimeo links as embedded videos at the top of the Videos page. */
export async function addVideoLinks(manifest, links, { tmpDir, log }) {
  const known = new Set(manifest.videos.map((v) => v.id));
  const videos = [];
  const failed = [];
  for (const link of links) {
    try {
      const entry = await processVideoLink(link, { tmpDir });
      if (known.has(entry.id)) {
        log(`${link} skipped: already on the site`);
        continue;
      }
      entry.source = "link";
      videos.push(entry);
      known.add(entry.id);
      log(`${link} added (${entry.kind})`);
    } catch (error) {
      failed.push({ file: link, error: error.message });
      log(`${link} failed: ${error.message}`);
    }
  }
  manifest.videos = [...videos, ...manifest.videos];
  return { added: videos.length, failed };
}

/**
 * Deletes media files no manifest item references. `includeHidden` keeps files
 * of hidden items (for the repo); the published site drops them.
 */
export async function pruneMedia(rootDir, manifest, { includeHidden }) {
  const visible = (e) => includeHidden || !e.hidden;
  const keep = new Set(
    [...manifest.photos.filter(visible).flatMap(photoFiles), ...manifest.videos.filter(visible).flatMap(videoFiles)].map(
      (url) => path.join(rootDir, url),
    ),
  );
  let removed = 0;
  let bytes = 0;
  for await (const file of walkFiles(path.join(rootDir, "media"))) {
    if (keep.has(file)) continue;
    bytes += (await fs.stat(file)).size;
    await fs.rm(file);
    removed++;
  }
  return { removed, bytes };
}

export async function directorySize(dir) {
  let total = 0;
  for await (const file of walkFiles(dir)) total += (await fs.stat(file)).size;
  return total;
}

export async function checkBudget(log) {
  const total = await directorySize(PUBLIC_DIR);
  if (total > SITE_MAX_BYTES) {
    throw new Error(
      `The site would be ${formatBytes(total)}, over the ${formatBytes(SITE_MAX_BYTES)} limit kept under GitHub Pages' 1 GB cap. ` +
        `Move long videos to YouTube or Vimeo, or remove some items, then try again.`,
    );
  }
  if (total > SITE_WARN_BYTES) log(`warning: the site is ${formatBytes(total)}; GitHub Pages allows 1 GB in total`);
  return total;
}

/**
 * Writes captions and dates from the private sidecar onto the manifest, or
 * removes them, following site.json. Items with no saved text are left alone.
 */
export async function applyStoredText(manifest, display = {}) {
  const file = path.join(PRIVATE_DIR, "instagram-text.json");
  let stored;
  try {
    stored = JSON.parse(await fs.readFile(file, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
  const apply = (entry) => {
    const text = stored[entry.id];
    if (!text) return entry;
    const next = { ...entry };
    if (display.captions && text.caption) next.caption = text.caption;
    else delete next.caption;
    if (display.dates && text.date) next.date = text.date;
    else delete next.date;
    return next;
  };
  manifest.photos = manifest.photos.map(apply);
  manifest.videos = manifest.videos.map(apply);
  return true;
}

/** Keeps every caption and date locally (git-ignored) so they can be published later without the export. */
export async function saveCaptionsPrivately(text) {
  if (Object.keys(text).length === 0) return null;
  const file = path.join(PRIVATE_DIR, "instagram-text.json");
  let existing = {};
  try {
    existing = JSON.parse(await fs.readFile(file, "utf8"));
  } catch {}
  await fs.mkdir(PRIVATE_DIR, { recursive: true });
  await fs.writeFile(file, `${JSON.stringify({ ...existing, ...text }, null, 2)}\n`);
  return file;
}

export function printFailures(failed, log) {
  if (failed.length === 0) return;
  log(`\n${failed.length} item(s) could not be added:`);
  for (const f of failed) log(`  - ${f.file}: ${f.error}`);
}
