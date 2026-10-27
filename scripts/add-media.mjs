#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { PUBLIC_DIR, formatBytes } from "./lib/config.mjs";
import {
  addFiles,
  addVideoLinks,
  applyStoredText,
  checkBudget,
  importInstagramItems,
  printFailures,
  pruneMedia,
  saveCaptionsPrivately,
  walkFiles,
  withTempDir,
} from "./lib/importer.mjs";
import { extractInstagramZips, looksLikeInstagramZip, readInstagramExport } from "./lib/instagram.mjs";
import { ensureCategory, readManifest, readSite, removeSamples, writeManifest } from "./lib/manifest.mjs";
import { mediaKind } from "./lib/media.mjs";
import { extractZip } from "./lib/zip.mjs";

const USAGE = `Add photos and videos to the site.

Usage:
  npm run media:add -- <files, folders, or .zip files> [options]

Instagram export zips are detected and imported automatically.

Options:
  --category <name>   Put new photos in a photo category (created if needed)
  --link <urls>       YouTube or Vimeo links to embed (repeat, or separate with spaces)
  --keep-samples      Keep the generated sample content
`;

const { values: opts, positionals: inputs } = parseArgs({
  allowPositionals: true,
  options: {
    category: { type: "string", default: "" },
    link: { type: "string", multiple: true, default: [] },
    "keep-samples": { type: "boolean", default: false },
    help: { type: "boolean", short: "h", default: false },
  },
});

const links = opts.link.flatMap((value) => value.split(/[\s,]+/)).filter(Boolean);
if (opts.help || (inputs.length === 0 && links.length === 0)) {
  console.log(USAGE);
  process.exit(opts.help ? 0 : 1);
}

const log = (message) => console.log(message);

await withTempDir(async (tmpDir) => {
  const files = [];
  const instagramZips = [];
  for (const input of inputs) {
    const stat = await fs.stat(input);
    const candidates = stat.isDirectory() ? await Array.fromAsync(walkFiles(input)) : [input];
    for (const file of candidates) {
      if (file.toLowerCase().endsWith(".zip")) {
        if (await looksLikeInstagramZip(file)) {
          instagramZips.push(file);
        } else {
          const dest = path.join(tmpDir, `zip-${files.length}-${path.basename(file, ".zip")}`);
          const extracted = await extractZip(
            file,
            dest,
            (name) => Boolean(mediaKind(name)) && !name.split("/").some((part) => part.startsWith(".") || part === "__MACOSX"),
          );
          files.push(...extracted.sort());
        }
      } else if (mediaKind(file)) {
        files.push(file);
      } else {
        log(`Skipping ${path.basename(file)}: not a photo, video, or zip.`);
      }
    }
  }

  const [manifest, site] = await Promise.all([readManifest(), readSite()]);
  const category = opts.category.trim() ? await ensureCategory(opts.category) : undefined;
  if (!opts["keep-samples"] && (files.length > 0 || instagramZips.length > 0 || links.length > 0)) {
    const removed = await removeSamples(manifest);
    if (removed.photos + removed.videos > 0) log(`Removed ${removed.photos + removed.videos} sample item(s).`);
  }

  const failed = [];
  let added = 0;
  if (instagramZips.length > 0) {
    log(`Importing Instagram export (${instagramZips.length} zip file(s))...`);
    const root = path.join(tmpDir, "instagram");
    await extractInstagramZips(instagramZips, root, {});
    const { items } = await readInstagramExport(root);
    const result = await importInstagramItems(manifest, items, { tmpDir, display: site.display, category, log });
    await saveCaptionsPrivately(result.text);
    added += result.added;
    failed.push(...result.failed);
  }
  if (files.length > 0) {
    log(`Adding ${files.length} file(s)...`);
    const result = await addFiles(manifest, files, { tmpDir, category, log });
    added += result.added;
    failed.push(...result.failed);
  }
  if (links.length > 0) {
    const result = await addVideoLinks(manifest, links, { tmpDir, log });
    added += result.added;
    failed.push(...result.failed);
  }

  await applyStoredText(manifest, site.display);
  await pruneMedia(PUBLIC_DIR, manifest, { includeHidden: true });
  const total = await checkBudget(log);
  await writeManifest(manifest);

  const summary = [
    `Added ${added} item(s). The site now has ${manifest.photos.length} photos and ${manifest.videos.length} videos (${formatBytes(total)} of media).`,
  ];
  log(`\n${summary[0]}`);
  printFailures(failed, log);
  if (process.env.GITHUB_STEP_SUMMARY) {
    const lines = [...summary, ...failed.map((f) => `- Could not add ${f.file}: ${f.error}`)];
    await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, `${lines.join("\n")}\n`);
  }
  if (added === 0 && failed.length > 0) process.exitCode = 1;
});
