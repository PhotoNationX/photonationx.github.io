import fs from "node:fs/promises";
import path from "node:path";
import {
  MANIFEST_PATH,
  PHOTO_URL_DIR,
  PUBLIC_DIR,
  SITE_PATH,
  VIDEO_URL_DIR,
} from "./config.mjs";

export const EMPTY_MANIFEST = { version: 1, photos: [], videos: [] };

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT" && fallback !== undefined) return structuredClone(fallback);
    throw error;
  }
}

async function writeJson(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(data, null, 2)}\n`);
}

export async function readManifest() {
  const manifest = await readJson(MANIFEST_PATH, EMPTY_MANIFEST);
  manifest.photos ??= [];
  manifest.videos ??= [];
  return manifest;
}

export function writeManifest(manifest) {
  return writeJson(MANIFEST_PATH, {
    version: 1,
    photos: manifest.photos,
    videos: manifest.videos,
  });
}

export const readSite = () => readJson(SITE_PATH);
export const writeSite = (site) => writeJson(SITE_PATH, site);

export const photoUrl = (id, width) => `${PHOTO_URL_DIR}/${id}-${width}.webp`;
export const videoUrl = (id) => `${VIDEO_URL_DIR}/${id}.mp4`;
export const posterUrl = (id, width) => `${VIDEO_URL_DIR}/${id}-poster-${width}.webp`;

/** Site-relative URLs of every file an item owns. Must mirror src/lib/media.ts. */
export function photoFiles(photo) {
  return photo.widths.map((width) => photoUrl(photo.id, width));
}

export function videoFiles(video) {
  const files = video.poster.widths.map((width) => posterUrl(video.id, width));
  if (video.kind === "file") files.push(videoUrl(video.id));
  return files;
}

export async function deleteFiles(urls) {
  await Promise.all(
    urls.map((url) => fs.rm(path.join(PUBLIC_DIR, url), { force: true })),
  );
}

/** Drops generated sample items (and their files) once real content arrives. */
export async function removeSamples(manifest) {
  const samplePhotos = manifest.photos.filter((p) => p.sample);
  const sampleVideos = manifest.videos.filter((v) => v.sample);
  await deleteFiles([
    ...samplePhotos.flatMap(photoFiles),
    ...sampleVideos.flatMap(videoFiles),
  ]);
  manifest.photos = manifest.photos.filter((p) => !p.sample);
  manifest.videos = manifest.videos.filter((v) => !v.sample);
  return { photos: samplePhotos.length, videos: sampleVideos.length };
}

export function slugify(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Finds or creates a photo category in site.json; returns its slug. */
export async function ensureCategory(name) {
  const slug = slugify(name);
  if (!slug) return undefined;
  const site = await readSite();
  site.photoCategories ??= [];
  const existing = site.photoCategories.find(
    (c) => c.slug === slug || slugify(c.title) === slug,
  );
  if (existing) return existing.slug;
  site.photoCategories.push({ slug, title: name.trim() });
  await writeSite(site);
  return slug;
}
