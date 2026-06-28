/**
 * Hero passager — export web depuis l’image source validée.
 * Usage: node scripts/build-hero.mjs
 */
import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const source = path.join(root, "assets/hero-passenger-hero.png");
const outJpg = path.join(root, "public/brand/hero-home.jpg");
const outWebp = path.join(root, "public/brand/hero-home.webp");

const OUT_W = 868;

if (!fs.existsSync(source)) {
  console.error("✗ assets/hero-passenger-hero.png introuvable");
  process.exit(1);
}

const pipeline = sharp(source).resize(OUT_W, null, { fit: "inside" });
const meta = await pipeline.metadata();

await pipeline.clone().jpeg({ quality: 100, mozjpeg: true, chromaSubsampling: "4:4:4" }).toFile(outJpg);
await pipeline.clone().webp({ quality: 98, effort: 6 }).toFile(outWebp);

console.log(`✓ hero ${meta.width}x${meta.height}`);
