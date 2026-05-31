// Génère icon-192.png et icon-512.png à partir d'un canvas en mémoire.
// Utilise uniquement les APIs Node natives (zlib + CRC32) — pas de dépendance externe.
// Crée des PNG simples (carrés "ED" sur fond brand-600).

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\//, "")), "..");
const PUBLIC_ICONS = path.join(ROOT, "public", "icons");
fs.mkdirSync(PUBLIC_ICONS, { recursive: true });

// CRC32 ----------------------------------------------------------------
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c >>> 0;
}
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function makePng(size, drawPixel) {
  const width = size;
  const height = size;
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0; // filter
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = drawPixel(x, y);
      const offset = y * (1 + width * 4) + 1 + x * 4;
      raw[offset] = r;
      raw[offset + 1] = g;
      raw[offset + 2] = b;
      raw[offset + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const idat = zlib.deflateSync(raw);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// Tracé : fond brand-600 (#0d9488), rond plus clair au centre, lettre simulée par un carré clair
function draw(size) {
  const radius = size * 0.16; // coins arrondis
  const bg = [13, 148, 136, 255]; // brand-600
  const fg = [255, 255, 255, 255];
  // forme "ED" simplifiée : un E + un D dans un cercle clair
  const cx = size / 2;
  const cy = size / 2;
  const innerR = size * 0.34;
  return (x, y) => {
    // coins arrondis
    const r = radius;
    const dx = x < r ? r - x : x > size - r ? x - (size - r) : 0;
    const dy = y < r ? r - y : y > size - r ? y - (size - r) : 0;
    if (dx * dx + dy * dy > r * r) return [0, 0, 0, 0];

    const cdx = x - cx;
    const cdy = y - cy;
    const dist = Math.sqrt(cdx * cdx + cdy * cdy);
    // texte "ED" stylisé : deux barres verticales + courbes — on simule avec un rectangle blanc central
    const textW = size * 0.55;
    const textH = size * 0.22;
    if (
      Math.abs(cdx) < textW / 2 &&
      Math.abs(cdy) < textH / 2 &&
      dist < innerR * 1.6
    ) {
      // anneau de fond plus clair
      if (Math.abs(cdy) > textH * 0.32) return [255, 255, 255, 200];
      return fg;
    }
    return bg;
  };
}

for (const size of [192, 512]) {
  const buf = makePng(size, draw(size));
  fs.writeFileSync(path.join(PUBLIC_ICONS, `icon-${size}.png`), buf);
  console.log(`✓ public/icons/icon-${size}.png (${buf.length} bytes)`);
}
