#!/usr/bin/env node
/**
 * Removes media files that content/media.json no longer lists.
 *   node scripts/prune-media.mjs public   # repo copy: keeps files of hidden items
 *   node scripts/prune-media.mjs out      # built site: drops hidden items too
 */
import path from "node:path";
import { ROOT, formatBytes } from "./lib/config.mjs";
import { pruneMedia } from "./lib/importer.mjs";
import { readManifest } from "./lib/manifest.mjs";

const target = process.argv[2] ?? "public";
const result = await pruneMedia(path.resolve(ROOT, target), await readManifest(), {
  includeHidden: target === "public",
});
console.log(`Removed ${result.removed} unused media file(s) from ${target}/ (${formatBytes(result.bytes)}).`);
