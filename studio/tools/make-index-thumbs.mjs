#!/usr/bin/env node
/* make-index-thumbs.mjs — generate small (≤400px) JPEG thumbnails for the studio INDEX tiles.
 *
 * Why: the index shows ~167 plates at ~90–430px, but the tiles load the full 2400px source
 * images. Decode cost scales with pixel count, so the browser re-decodes huge images on every
 * grid-density change — the stutter. A 400px thumb decodes ~30× cheaper.
 *
 * Structure (deliberately simple — a mirror tree):
 *     studio/assets/img/{slug}/{file}.jpg         (originals, untouched)
 *     studio/assets/img-thumb/{slug}/{base}.jpg   (thumbs, same slug + name, ≤400px)
 * The thumb path is just the original path with "img" → "img-thumb" and a .jpg extension.
 * img-upgrade.js matches "assets/img/" only, so it never touches "assets/img-thumb/".
 *
 * Maintenance: add a work/plate to studio.json + drop its source image in assets/img/{slug}/,
 * then run this script. It is idempotent — it skips thumbs already newer than their source.
 *   node studio/tools/make-index-thumbs.mjs            # generate missing/stale thumbs
 *   node studio/tools/make-index-thumbs.mjs --force    # rebuild all
 * Uses only macOS `sips` (built in) — no dependencies to install.
 */
import { readFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const STUDIO = resolve(HERE, "..");                 // studio/
const SRC_DIR = join(STUDIO, "assets", "img");
const OUT_DIR = join(STUDIO, "assets", "img-thumb");
const MAX = 600, QUALITY = 74;   // 600px keeps the biggest (sparse-density) tiles crisp on retina while still decoding ~14× cheaper than the 2400px source
const FORCE = process.argv.includes("--force");

const st = JSON.parse(readFileSync(join(STUDIO, "data", "studio.json"), "utf8"));
const isVid = im => im.video || /\.(mp4|webm|mov)$/i.test(im.file || "");
const isRemote = im => /^https?:\/\//i.test(im.file || "");

let made = 0, skipped = 0, missing = 0;
for (const w of st.works || []) {
  for (const im of w.images || []) {
    if (!im.file || isVid(im) || isRemote(im)) continue;
    const srcPath = join(SRC_DIR, w.slug, im.file);
    const base = im.file.replace(/\.[^.]+$/, "");
    const outPath = join(OUT_DIR, w.slug, base + ".jpg");
    if (!existsSync(srcPath)) { console.warn(`  MISSING source: ${w.slug}/${im.file}`); missing++; continue; }
    if (!FORCE && existsSync(outPath) && statSync(outPath).mtimeMs >= statSync(srcPath).mtimeMs) { skipped++; continue; }
    mkdirSync(dirname(outPath), { recursive: true });
    execFileSync("sips", ["-Z", String(MAX), "-s", "format", "jpeg", "-s", "formatOptions", String(QUALITY), srcPath, "--out", outPath], { stdio: "ignore" });
    made++;
    if (made % 25 === 0) process.stdout.write(`\r  made ${made} …`);
  }
}
console.log(`\nthumbs: ${made} made, ${skipped} up-to-date, ${missing} missing source → ${OUT_DIR.replace(STUDIO + "/", "studio/")}`);
