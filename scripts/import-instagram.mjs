#!/usr/bin/env node
import path from "node:path";
import { parseArgs } from "node:util";
import { PUBLIC_DIR, formatBytes } from "./lib/config.mjs";
import {
  checkBudget,
  applyStoredText,
  importInstagramItems,
  printFailures,
  pruneMedia,
  saveCaptionsPrivately,
  withTempDir,
} from "./lib/importer.mjs";
import { extractInstagramZips, readInstagramExport } from "./lib/instagram.mjs";
import { ensureCategory, readManifest, readSite, removeSamples, writeManifest } from "./lib/manifest.mjs";

const USAGE = `Import photos and videos from an Instagram "Download your information" export (JSON format).

Usage:
  npm run import:instagram -- <export folder | export.zip [part2.zip ...]> [options]

Options:
  --category <name>   Put the imported photos in a photo category (e.g. "Portraits")
  --stories           Also import stories (skipped by default)
  --no-photos         Skip photos
  --no-videos         Skip videos and reels
  --limit <n>         Import only the newest n items (for a quick test)
  --keep-samples      Keep the generated sample content
  --dry-run           List what would be imported without changing anything
`;

const { values: opts, positionals: inputs } = parseArgs({
  allowPositionals: true,
  options: {
    category: { type: "string" },
    stories: { type: "boolean", default: false },
    "no-photos": { type: "boolean", default: false },
    "no-videos": { type: "boolean", default: false },
    limit: { type: "string" },
    "keep-samples": { type: "boolean", default: false },
    "dry-run": { type: "boolean", default: false },
    help: { type: "boolean", short: "h", default: false },
  },
});

if (opts.help || inputs.length === 0) {
  console.log(USAGE);
  process.exit(opts.help ? 0 : 1);
}

const log = (message) => console.log(message);
const zips = inputs.filter((p) => p.toLowerCase().endsWith(".zip"));
const folders = inputs.filter((p) => !p.toLowerCase().endsWith(".zip"));
if (folders.length > 1 || (folders.length > 0 && zips.length > 0)) {
  console.error("Pass one unzipped export folder, or one or more export .zip parts.");
  process.exit(1);
}

await withTempDir(async (tmpDir) => {
  let root = folders[0];
  if (zips.length > 0) {
    root = path.join(tmpDir, "export");
    log(`Unpacking posts and reels from ${zips.length} zip file(s)...`);
    await extractInstagramZips(zips, root, { includeStories: opts.stories });
  }

  const { items: all, missing } = await readInstagramExport(root, { includeStories: opts.stories });
  let items = all.filter((item) => (item.kind === "photo" ? !opts["no-photos"] : !opts["no-videos"]));
  if (opts.limit) items = items.slice(0, Number(opts.limit));
  const count = (kind) => items.filter((i) => i.kind === kind).length;
  log(`Found ${count("photo")} photos and ${count("video")} videos.`);
  if (missing.length > 0) {
    log(`${missing.length} file(s) listed in the export are missing (multi-part export? pass every .zip part).`);
  }

  if (opts["dry-run"]) {
    for (const item of items) {
      log(`${new Date(item.timestamp * 1000).toISOString().slice(0, 10)}  ${item.kind}  ${item.source}  ${path.relative(root, item.file)}`);
    }
    return;
  }

  const [manifest, site] = await Promise.all([readManifest(), readSite()]);
  if (!opts["keep-samples"]) {
    const removed = await removeSamples(manifest);
    if (removed.photos + removed.videos > 0) log(`Removed ${removed.photos + removed.videos} sample item(s).`);
  }
  const category = opts.category ? await ensureCategory(opts.category) : undefined;
  const result = await importInstagramItems(manifest, items, { tmpDir, display: site.display, category, log });

  const privateFile = await saveCaptionsPrivately(result.text);
  await applyStoredText(manifest, site.display);

  const pruned = await pruneMedia(PUBLIC_DIR, manifest, { includeHidden: true });
  if (pruned.removed > 0) log(`Cleaned up ${pruned.removed} unused file(s) (${formatBytes(pruned.bytes)}).`);
  const total = await checkBudget(log);
  await writeManifest(manifest);

  log(`\nAdded ${result.added} new item(s); ${result.reused} were already on the site.`);
  log(`Site media now ${formatBytes(total)}: ${manifest.photos.length} photos, ${manifest.videos.length} videos.`);
  if (privateFile) {
    log(`Captions and dates saved privately to ${path.relative(process.cwd(), privateFile)} (not committed).`);
  }
  printFailures(result.failed, log);
});
