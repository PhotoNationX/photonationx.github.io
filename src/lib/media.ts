import type { ImageSource, Photo, Video } from "@/lib/content";

/** Prefix a site-relative URL with the GitHub Pages base path. next/link does this on its own. */
export function withBasePath(src: string): string {
  const base = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/$/, "");
  if (!src.startsWith("/")) return src;
  return `${base}${src}`;
}

export function srcSet(sources: ImageSource[]): string {
  return sources.map((source) => `${withBasePath(source.src)} ${source.width}w`).join(", ");
}

/** Must match scripts/lib/manifest.mjs. */
export function photoSrc(id: string, width: number): string {
  return withBasePath(`/media/photos/${id}-${width}.webp`);
}

export function videoSrc(id: string): string {
  return withBasePath(`/media/videos/${id}.mp4`);
}

export function posterSrc(id: string, width: number): string {
  return withBasePath(`/media/videos/${id}-poster-${width}.webp`);
}

export function photoSrcSet(photo: Photo): string {
  return photo.widths.map((width) => `${photoSrc(photo.id, width)} ${width}w`).join(", ");
}

export function posterSrcSet(video: Video): string {
  return video.poster.widths.map((width) => `${posterSrc(video.id, width)} ${width}w`).join(", ");
}

export function largestWidth(widths: number[]): number {
  return widths[widths.length - 1] ?? widths[0];
}

export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

export function videoLabel(video: Video): string {
  return video.title || video.caption || "Video";
}

export function photoLabel(photo: Photo): string {
  return photo.caption || "Photograph";
}
