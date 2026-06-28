/**
 * Recrée le bandeau hero depuis la référence utilisateur (photo seule, sans onglets).
 * Usage: node scripts/crop-hero.mjs
 */
import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const reference = path.join(root, "public/brand/hero-reference.png");
const outJpg = path.join(root, "public/brand/hero-home.jpg");
const outWebp = path.join(root, "public/brand/hero-home.webp");

const meta = await sharp(reference).metadata();
const w = meta.width ?? 673;
const h = meta.height ?? 517;

// Photo hero uniquement — s'arrête juste au-dessus des onglets bleus/gris.
const left = 0;
const top = 0;
const cropW = w;
const cropH = Math.round(h * 0.805);

const targetW = 345;

const pipeline = sharp(reference)
  .extract({ left, top, width: cropW, height: cropH })
  .resize(targetW)
  .modulate({ brightness: 1.04, saturation: 1.02 });

await pipeline.clone().jpeg({ quality: 94, mozjpeg: true }).toFile(outJpg);
await pipeline.clone().webp({ quality: 92 }).toFile(outWebp);

const outMeta = await sharp(outJpg).metadata();
console.log(`✓ ${outJpg} (${outMeta.width}x${outMeta.height})`);
console.log(`✓ ${outWebp}`);
