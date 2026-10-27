import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const CONTENT_DIR = path.join(ROOT, "content");
export const MANIFEST_PATH = path.join(CONTENT_DIR, "media.json");
export const SITE_PATH = path.join(CONTENT_DIR, "site.json");
export const PUBLIC_DIR = path.join(ROOT, "public");
export const PRIVATE_DIR = path.join(ROOT, "private");

/** Public URL prefixes (relative to the site root, before any base path). */
export const PHOTO_URL_DIR = "/media/photos";
export const VIDEO_URL_DIR = "/media/videos";

/** Responsive widths for gallery photos; anything wider than the original is skipped. */
export const PHOTO_WIDTHS = [400, 800, 1200, 1600, 2048];
export const POSTER_WIDTHS = [360, 720];
export const WEBP_QUALITY = 80;

/** "About 720p": the short side of a video is scaled down to this. */
export const VIDEO_SHORT_SIDE = 720;

const MB = 1024 * 1024;
/** GitHub warns about files over 50 MB and rejects files over 100 MB. */
export const FILE_WARN_BYTES = 50 * MB;
export const FILE_MAX_BYTES = 95 * MB;
/** GitHub Pages sites must stay under 1 GB; keep a wide margin. */
export const SITE_WARN_BYTES = 700 * MB;
export const SITE_MAX_BYTES = 900 * MB;

export const PHOTO_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif", ".tif", ".tiff", ".gif", ".heic", ".heif"]);
export const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".m4v", ".webm", ".mkv", ".avi", ".3gp"]);

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < MB) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * MB) return `${(bytes / MB).toFixed(1)} MB`;
  return `${(bytes / (1024 * MB)).toFixed(2)} GB`;
}
