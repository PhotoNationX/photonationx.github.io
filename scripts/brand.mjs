#!/usr/bin/env node
/**
 * Builds the header logo, favicons, home banner, and link-preview image from
 * the files in brand/. Run after replacing a file there: `npm run brand`.
 *
 * The lens geometry in brand/sources.json only applies to the logo whose
 * pixels match `pixelFingerprint`. For any other logo, the lens steps are
 * skipped and the plain trimmed logo is used everywhere.
 */
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { ROOT } from "./lib/config.mjs";

const SRC_DIR = path.join(ROOT, "brand");
const OUT_DIR = path.join(ROOT, "public", "brand");
const APP_DIR = path.join(ROOT, "src", "app");
const BRAND_MANIFEST = path.join(ROOT, "content", "brand.json");

const LOGO_WIDTHS = [320, 640, 960];
const BANNER_WIDTHS = [640, 960, 1600, 2400];
const OG_SIZE = { width: 1200, height: 630 };
/** Rows or columns darker than this (0-255 average) count as letterbox bars. */
const BAR_THRESHOLD = 14;

const sources = JSON.parse(await fs.readFile(path.join(SRC_DIR, "sources.json"), "utf8"));
await fs.mkdir(OUT_DIR, { recursive: true });

const brand = { logo: await buildLogo(sources.logo), banner: await buildBanner(sources.banner) };
await fs.writeFile(BRAND_MANIFEST, `${JSON.stringify(brand, null, 2)}\n`);
console.log(`Brand assets written to public/brand and src/app; summary in content/brand.json`);

async function buildLogo({ file, lens }) {
  const input = path.join(SRC_DIR, file);
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const bounds = alphaBounds(data, info);
  const fingerprint = crypto
    .createHash("sha256")
    .update(data)
    .update(`${info.width}x${info.height}`)
    .digest("hex")
    .slice(0, 16);
  const lensMatches = lens && lens.pixelFingerprint === fingerprint;
  if (lens && !lensMatches) {
    console.warn(
      `brand/${file} changed (fingerprint ${fingerprint}); skipping the lens favicon and the no-lens-text logo. ` +
        `Update "lens" in brand/sources.json to re-enable them.`,
    );
  }

  const variants = { original: await sharp(input).extract(bounds).png().toBuffer() };
  let iconSource;
  if (lensMatches) {
    const cleanLens = await buildCleanLens(input, lens);
    const withCleanLens = await sharp(input)
      .composite([{ input: cleanLens, left: lens.centerX - lens.radius, top: lens.centerY - lens.radius }])
      .png()
      .toBuffer();
    variants.clean = await sharp(withCleanLens).extract(bounds).png().toBuffer();
    iconSource = cleanLens;
  } else {
    const side = bounds.height;
    iconSource = await sharp(variants.original)
      .extract({ left: 0, top: 0, width: Math.min(side, bounds.width), height: side })
      .png()
      .toBuffer();
  }

  const logo = { width: bounds.width, height: bounds.height, variants: {} };
  for (const [name, buffer] of Object.entries(variants)) {
    const base = name === "original" ? "logo" : `logo-${name}`;
    await fs.writeFile(path.join(OUT_DIR, `${base}.png`), buffer);
    const widths = LOGO_WIDTHS.filter((w) => w < bounds.width).concat(
      LOGO_WIDTHS.some((w) => w >= bounds.width) ? [bounds.width] : [],
    );
    logo.variants[name] = [];
    for (const width of widths) {
      const src = `/brand/${base}-${width}.webp`;
      await sharp(buffer)
        .resize({ width })
        .webp({ quality: 90, alphaQuality: 100, effort: 4 })
        .toFile(path.join(ROOT, "public", src));
      logo.variants[name].push({ src, width });
    }
  }

  await writeIcons(iconSource);
  return logo;
}

/** The lens without its ring text: the inner glass inside a plain dark bezel. */
async function buildCleanLens(input, { centerX, centerY, radius, glassRadius }) {
  const size = radius * 2;
  const circle = (r) =>
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="${radius}" cy="${radius}" r="${r}" fill="#fff"/></svg>`,
    );
  const glass = await sharp(input)
    .extract({ left: centerX - radius, top: centerY - radius, width: size, height: size })
    .composite([{ input: circle(glassRadius), blend: "dest-in" }])
    .png()
    .toBuffer();
  const bezel = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <defs><radialGradient id="g" cx="50%" cy="50%" r="50%">
      <stop offset="80%" stop-color="#050507"/><stop offset="93%" stop-color="#1c1c22"/><stop offset="100%" stop-color="#3a3a42"/>
    </radialGradient></defs>
    <circle cx="${radius}" cy="${radius}" r="${radius - 0.5}" fill="url(#g)"/>
    <circle cx="${radius}" cy="${radius}" r="${radius - 1.2}" fill="none" stroke="#6b6b75" stroke-opacity="0.55" stroke-width="1.2"/>
  </svg>`);
  return sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: bezel }, { input: glass }])
    .png()
    .toBuffer();
}

async function writeIcons(source) {
  const square = (size) => sharp(source).resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } });
  const icoImages = await Promise.all([16, 32, 48].map(async (size) => ({ size, data: await square(size).png().toBuffer() })));
  await fs.writeFile(path.join(APP_DIR, "favicon.ico"), encodeIco(icoImages));
  await square(192).png({ palette: true, quality: 95, effort: 10 }).toFile(path.join(APP_DIR, "icon.png"));
  // iOS fills transparency with black, so the home-screen icon sits on white.
  const onWhite = await sharp({ create: { width: 180, height: 180, channels: 4, background: "#ffffff" } })
    .composite([{ input: await square(148).png().toBuffer(), gravity: "center" }])
    .png()
    .toBuffer();
  await sharp(onWhite)
    .flatten({ background: "#ffffff" })
    .png({ palette: true, quality: 95, effort: 10 })
    .toFile(path.join(APP_DIR, "apple-icon.png"));
}

/** ICO container holding PNG images (supported by every current browser). */
function encodeIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  const directory = Buffer.alloc(16 * images.length);
  let offset = header.length + directory.length;
  images.forEach(({ size, data }, i) => {
    const o = i * 16;
    directory.writeUInt8(size >= 256 ? 0 : size, o);
    directory.writeUInt8(size >= 256 ? 0 : size, o + 1);
    directory.writeUInt16LE(1, o + 4);
    directory.writeUInt16LE(32, o + 6);
    directory.writeUInt32LE(data.length, o + 8);
    directory.writeUInt32LE(offset, o + 12);
    offset += data.length;
  });
  return Buffer.concat([header, directory, ...images.map((image) => image.data)]);
}

async function buildBanner({ file }) {
  const input = path.join(SRC_DIR, file);
  const { data, info } = await sharp(input).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const crop = contentBounds(data, info);
  const cropped = await sharp(input).extract(crop).png().toBuffer();
  const { dominant } = await sharp(cropped).stats();

  const widths = BANNER_WIDTHS.filter((w) => w < crop.width).concat([crop.width]);
  const sources = [];
  for (const width of widths) {
    const src = `/brand/banner-${width}.webp`;
    await sharp(cropped).resize({ width }).webp({ quality: 84, effort: 4 }).toFile(path.join(ROOT, "public", src));
    sources.push({ src, width });
  }

  // Link previews want 1.91:1; trim the taller banner from the bottom so faces in the top row stay whole.
  await sharp(cropped)
    .resize(OG_SIZE.width, OG_SIZE.height, { fit: "cover", position: "top" })
    .jpeg({ quality: 86, mozjpeg: true })
    .toFile(path.join(OUT_DIR, "og-image.jpg"));

  return {
    width: crop.width,
    height: crop.height,
    color: toHex(dominant),
    sources,
    ogImage: { src: "/brand/og-image.jpg", ...OG_SIZE },
  };
}

function alphaBounds(data, { width, height, channels }) {
  let left = width, top = height, right = -1, bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * channels + 3] === 0) continue;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }
  if (right < 0) throw new Error("Logo is fully transparent");
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

/** Bounds of the image without letterbox bars on any side. */
function contentBounds(data, { width, height, channels }) {
  const brightness = (x, y) => {
    const i = (y * width + x) * channels;
    return Math.max(data[i], data[i + 1], data[i + 2]);
  };
  const rowMean = (y) => {
    let sum = 0;
    for (let x = 0; x < width; x++) sum += brightness(x, y);
    return sum / width;
  };
  const colMean = (x, top, bottom) => {
    let sum = 0;
    for (let y = top; y <= bottom; y++) sum += brightness(x, y);
    return sum / (bottom - top + 1);
  };
  let top = 0, bottom = height - 1;
  while (top < bottom && rowMean(top) < BAR_THRESHOLD) top++;
  while (bottom > top && rowMean(bottom) < BAR_THRESHOLD) bottom--;
  let left = 0, right = width - 1;
  while (left < right && colMean(left, top, bottom) < BAR_THRESHOLD) left++;
  while (right > left && colMean(right, top, bottom) < BAR_THRESHOLD) right--;
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

function toHex({ r, g, b }) {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}
