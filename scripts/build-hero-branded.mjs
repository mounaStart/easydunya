/**
 * Hero logo-colors — hero-home.jpg, masque des titres blancs, titres SVG bleu/orange.
 * Usage: node scripts/build-hero-branded.mjs
 */
import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const source = path.join(root, "public/brand/hero-home.jpg");
const outJpg = path.join(root, "public/brand/hero-logo-colors.jpg");
const outWebp = path.join(root, "public/brand/hero-logo-colors.webp");
const outPng = path.join(root, "assets/hero-passenger-bg.png");

const LOGO_BLUE = "#1565c0";
const LOGO_ORANGE = "#f97316";

function heroTitleSvg(w, h) {
  const padX = Math.round(w * 0.042);
  const titleSize = Math.round(w * 0.078);
  const line1Y = Math.round(h * 0.168);
  const line2Y = Math.round(h * 0.248);
  const style = (color) =>
    `font-family="Inter,Arial,Helvetica,sans-serif" font-size="${titleSize}" font-weight="800" fill="${color}"`;

  return Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <text x="${padX}" y="${line1Y}" ${style(LOGO_BLUE)}>Votre voyage,</text>
    <text x="${padX}" y="${line2Y}" ${style(LOGO_ORANGE)}>notre priorité</text>
  </svg>`);
}

async function titleCoverPatch(sourceBuffer, w, h) {
  const coverW = Math.round(w * 0.9);
  const coverH = Math.round(h * 0.295);
  const srcLeft = Math.round(w * 0.52);
  const srcTop = Math.round(h * 0.03);
  const srcW = Math.round(w * 0.42);
  const srcH = Math.round(h * 0.28);

  return sharp(sourceBuffer)
    .extract({ left: srcLeft, top: srcTop, width: srcW, height: srcH })
    .resize(coverW, coverH, { fit: "fill", kernel: sharp.kernel.lanczos3 })
    .blur(0.3)
    .toBuffer();
}

if (!fs.existsSync(source)) {
  console.error("✗ hero-home.jpg introuvable");
  process.exit(1);
}

const sourceBuffer = await sharp(source).toBuffer();
const { width: w, height: h } = await sharp(sourceBuffer).metadata();
const cover = await titleCoverPatch(sourceBuffer, w, h);

const branded = await sharp(sourceBuffer)
  .composite([
    { input: cover, top: 0, left: 0 },
    { input: heroTitleSvg(w, h), top: 0, left: 0 },
  ])
  .sharpen({ sigma: 0.4, m1: 1, m2: 0.25 })
  .jpeg({ quality: 100, mozjpeg: true, chromaSubsampling: "4:4:4" })
  .toBuffer();

await sharp(branded).jpeg({ quality: 100, mozjpeg: true, chromaSubsampling: "4:4:4" }).toFile(outJpg);
await sharp(branded).webp({ quality: 98, effort: 6 }).toFile(outWebp);
await sharp(branded).png({ compressionLevel: 6 }).toFile(outPng);

console.log(`✓ hero logo-colors ${w}x${h}`);
console.log(`  → ${outJpg}`);
console.log(`  → ${outWebp}`);
console.log(`  → ${outPng}`);
