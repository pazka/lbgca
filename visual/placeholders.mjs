// Valid, deterministic placeholder pictures for the ihm front's images (Node built-ins only).
//
// The front's real images and video are NOT in git (root .gitignore ignores *.png/*.jpg/*.mp4; they live on
// the owner's Google Drive, ihm/public/README-ressource-to-fetch.txt). CI's compile check puts 8-byte stubs
// there (scripts/ihm-stub-assets.sh), which a browser shows as broken pictures. For the visual harness every
// picture path the sources reference (CSS/JS `img/...` in src/, product photos of src/domain/inventory.json in
// public/, the PWA icons) gets a real PNG instead: one flat colour derived from the path (so two different
// pictures never look alike) with a darker 4 px frame (so its box is visible). Existing files are kept.
// The .jpg ones are PNG bytes too: browsers sniff the content, webpack does not care.
// The landing video (public/video/night.mp4) gets no placeholder: the page shows an empty <video> box.
//
//   node visual/placeholders.mjs <ihm dir>     (run on a COPY of ihm/, see visual/build-ihm.sh)
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { deflateSync } from "node:zlib";

const ihm = process.argv[2];
if (!ihm || !existsSync(join(ihm, "src"))) {
  console.error("usage: node visual/placeholders.mjs <ihm dir>");
  process.exit(2);
}

const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

/** A w x h RGB PNG: flat colour from the path's hash, darker 4 px frame. */
export function placeholder(path, w, h) {
  const d = createHash("sha256").update(path).digest();
  // pastel fill (128..255 per channel) and a frame at half of it
  const fill = [128 + (d[0] >> 1), 128 + (d[1] >> 1), 128 + (d[2] >> 1)];
  const frame = fill.map((v) => v >> 1);
  const rows = [];
  for (let y = 0; y < h; y++) {
    const row = Buffer.alloc(1 + w * 3); // filter byte 0 (none)
    for (let x = 0; x < w; x++) {
      const edge = x < 4 || y < 4 || x >= w - 4 || y >= h - 4;
      const c = edge ? frame : fill;
      row[1 + x * 3] = c[0]; row[2 + x * 3] = c[1]; row[3 + x * 3] = c[2];
    }
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0; // 8-bit RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr), chunk("IDAT", deflateSync(Buffer.concat(rows), { level: 9 })), chunk("IEND", Buffer.alloc(0)),
  ]);
}

const walk = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? walk(p) : [p];
});

const wanted = new Map(); // file path -> [w, h]
// 1. every img/... the sources import (CSS url(), JS import), in src/ (webpack) and public/ (scripts/ihm-stub-assets.sh does the same)
for (const f of walk(join(ihm, "src")).filter((f) => /\.(js|jsx|ts|tsx|css)$/.test(f))) {
  for (const m of readFileSync(f, "utf8").matchAll(/img\/[A-Za-z0-9_./-]+\.(png|jpe?g|gif)/g)) {
    wanted.set(join(ihm, "src", m[0]), [96, 64]);
    wanted.set(join(ihm, "public", m[0]), [96, 64]);
  }
}
// 2. the product photos (relative URLs of inventory.json, served from public/)
const inventory = JSON.parse(readFileSync(join(ihm, "src/domain/inventory.json"), "utf8").replace(/^﻿/, ""));
for (const p of inventory.products) for (const img of p.images) wanted.set(join(ihm, "public", img), [400, 300]);
// 3. the PWA icons index.html / manifest.json name
for (const icon of ["logo192.png", "logo512.png"]) wanted.set(join(ihm, "public", icon), [64, 64]);

let n = 0;
for (const [file, [w, h]] of [...wanted].sort()) {
  // an existing real picture is kept; an 8-byte stub of scripts/ihm-stub-assets.sh is replaced
  if (existsSync(file) && statSync(file).size > 64) continue;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, placeholder(file.slice(ihm.length).replace(/^\/(src|public)\//, ""), w, h));
  n++;
}
console.log(`placeholders: ${n} picture(s) written under ${ihm}`);
