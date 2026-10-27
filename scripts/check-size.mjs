#!/usr/bin/env node
/** Fails if a built site breaks GitHub's file-size or Pages site-size limits. */
import fs from "node:fs/promises";
import path from "node:path";
import {
  FILE_MAX_BYTES,
  FILE_WARN_BYTES,
  ROOT,
  SITE_MAX_BYTES,
  SITE_WARN_BYTES,
  formatBytes,
} from "./lib/config.mjs";
import { walkFiles } from "./lib/importer.mjs";

const dir = path.resolve(ROOT, process.argv[2] ?? "out");
const files = [];
for await (const file of walkFiles(dir)) files.push({ file, size: (await fs.stat(file)).size });
if (files.length === 0) {
  console.error(`Nothing found in ${dir}. Run "npm run build" first.`);
  process.exit(1);
}

const total = files.reduce((sum, f) => sum + f.size, 0);
const rel = (f) => path.relative(dir, f.file);
let failed = false;

console.log(`${files.length} files, ${formatBytes(total)} in ${path.relative(ROOT, dir)}/`);
for (const f of files.sort((a, b) => b.size - a.size).slice(0, 5)) console.log(`  ${formatBytes(f.size).padStart(9)}  ${rel(f)}`);

for (const f of files) {
  if (f.size > FILE_MAX_BYTES) {
    console.error(`ERROR ${rel(f)} is ${formatBytes(f.size)}; GitHub rejects files over 100 MB.`);
    failed = true;
  } else if (f.size > FILE_WARN_BYTES) {
    console.warn(`warning: ${rel(f)} is ${formatBytes(f.size)}; GitHub warns above 50 MB.`);
  }
}
if (total > SITE_MAX_BYTES) {
  console.error(`ERROR the site is ${formatBytes(total)}; keep it under ${formatBytes(SITE_MAX_BYTES)} (GitHub Pages limit: 1 GB).`);
  failed = true;
} else if (total > SITE_WARN_BYTES) {
  console.warn(`warning: the site is ${formatBytes(total)}; GitHub Pages allows 1 GB.`);
}
process.exit(failed ? 1 : 0);
