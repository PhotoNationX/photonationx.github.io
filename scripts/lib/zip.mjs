import { createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import yauzl from "yauzl";

function openZip(file) {
  return new Promise((resolve, reject) =>
    yauzl.open(file, { lazyEntries: true, autoClose: true }, (error, zip) => (error ? reject(error) : resolve(zip))),
  );
}

/** Lists file names in a zip without extracting anything. */
export async function listZip(file) {
  const zip = await openZip(file);
  return new Promise((resolve, reject) => {
    const names = [];
    zip.on("entry", (entry) => {
      if (!entry.fileName.endsWith("/")) names.push(entry.fileName);
      zip.readEntry();
    });
    zip.on("end", () => resolve(names));
    zip.on("error", reject);
    zip.readEntry();
  });
}

/** Extracts only the entries `keep(name)` accepts; returns the extracted paths. */
export async function extractZip(file, destination, keep) {
  const zip = await openZip(file);
  const root = path.resolve(destination);
  const written = [];
  return new Promise((resolve, reject) => {
    zip.on("entry", async (entry) => {
      try {
        const name = entry.fileName;
        const target = path.resolve(root, name);
        if (!name.endsWith("/") && keep(name) && target.startsWith(`${root}${path.sep}`)) {
          await fs.mkdir(path.dirname(target), { recursive: true });
          const stream = await new Promise((res, rej) =>
            zip.openReadStream(entry, (error, s) => (error ? rej(error) : res(s))),
          );
          await pipeline(stream, createWriteStream(target));
          written.push(target);
        }
        zip.readEntry();
      } catch (error) {
        zip.close();
        reject(error);
      }
    });
    zip.on("end", () => resolve(written));
    zip.on("error", reject);
    zip.readEntry();
  });
}
