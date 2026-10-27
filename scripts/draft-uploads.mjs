#!/usr/bin/env node
/**
 * Used by the "Add photos and videos" workflow. Files attached to a *draft*
 * GitHub release stay private and never enter git history.
 *
 *   node scripts/draft-uploads.mjs download <dir>   # save every draft release's files
 *   node scripts/draft-uploads.mjs delete <dir>     # delete the drafts that were downloaded
 *
 * Needs GITHUB_TOKEN (or GH_TOKEN) with contents: write, and GITHUB_REPOSITORY.
 */
import { createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const [command, dir] = process.argv.slice(2);
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
const repo = process.env.GITHUB_REPOSITORY;
if (!["download", "delete"].includes(command) || !dir || !token || !repo) {
  console.error("Usage: GITHUB_TOKEN=... GITHUB_REPOSITORY=owner/repo node scripts/draft-uploads.mjs <download|delete> <dir>");
  process.exit(1);
}
const listFile = path.join(dir, ".drafts.json");

async function api(pathname, { method = "GET", accept = "application/vnd.github+json" } = {}) {
  const response = await fetch(`https://api.github.com${pathname}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, Accept: accept, "X-GitHub-Api-Version": "2022-11-28" },
  });
  if (!response.ok) throw new Error(`${method} ${pathname} failed: ${response.status} ${await response.text()}`);
  return response;
}

async function setOutput(name, value) {
  if (process.env.GITHUB_OUTPUT) await fs.appendFile(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}

if (command === "download") {
  await fs.mkdir(dir, { recursive: true });
  const releases = [];
  for (let page = 1; ; page++) {
    const batch = await (await api(`/repos/${repo}/releases?per_page=100&page=${page}`)).json();
    releases.push(...batch);
    if (batch.length < 100) break;
  }
  const drafts = releases.filter((r) => r.draft && r.assets.length > 0);
  let count = 0;
  for (const draft of drafts) {
    for (const asset of draft.assets) {
      const name = `${draft.id}-${asset.name.replace(/[^\w.-]+/g, "_")}`;
      console.log(`Downloading ${asset.name} (${Math.round(asset.size / 1024 / 1024)} MB) from draft "${draft.name || draft.tag_name}"`);
      const response = await api(`/repos/${repo}/releases/assets/${asset.id}`, { accept: "application/octet-stream" });
      await pipeline(Readable.fromWeb(response.body), createWriteStream(path.join(dir, name)));
      count++;
    }
  }
  await fs.writeFile(listFile, JSON.stringify(drafts.map((d) => d.id)));
  console.log(`Downloaded ${count} file(s) from ${drafts.length} draft release(s).`);
  await setOutput("found", count > 0 ? "true" : "false");
} else {
  const ids = JSON.parse(await fs.readFile(listFile, "utf8"));
  for (const id of ids) {
    await api(`/repos/${repo}/releases/${id}`, { method: "DELETE" });
    console.log(`Deleted draft release ${id}.`);
  }
}
