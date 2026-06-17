// Génère les sources d'icônes (1024x1024) pour @capacitor/assets :
// fond dégradé bleu → orange (comme l'icône PWABuilder) + emblème Easy Dunya.
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "public", "brand", "emblem.png");
const OUT = path.join(ROOT, "assets");
const SIZE = 1024;
const RADIUS = Math.round(SIZE * 0.22);
const BLUE = "#1e88d6";
const ORANGE = "#f97316";

fs.mkdirSync(OUT, { recursive: true });

/** Fond dégradé diagonal avec coins arrondis (style icône 1). */
async function gradientBg() {
  const svg = `<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${BLUE}"/>
        <stop offset="100%" stop-color="${ORANGE}"/>
      </linearGradient>
    </defs>
    <rect width="${SIZE}" height="${SIZE}" rx="${RADIUS}" ry="${RADIUS}" fill="url(#g)"/>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/**
 * Emblème sans fond blanc.
 * L'image source est en paysage → on force la largeur pour remplir ~96% de l'icône.
 */
async function emblemLayer(widthPx) {
  const { data, info } = await sharp(SRC)
    .ensureAlpha()
    .resize({ width: widthPx, withoutEnlargement: false })
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (r > 235 && g > 235 && b > 235) data[i + 3] = 0;
  }

  return sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer();
}

const bg = await gradientBg();

// Icône launcher : emblème large (~96% de la largeur)
const emblemFull = await emblemLayer(Math.round(SIZE * 0.96));
await sharp(bg)
  .composite([{ input: emblemFull, gravity: "center" }])
  .png()
  .toFile(path.join(OUT, "icon-only.png"));
console.log("✓ assets/icon-only.png");

// Icône adaptative — premier plan (zone de sécurité ~66%)
const emblemFg = await emblemLayer(Math.round(SIZE * 0.66));
await sharp({
  create: { width: SIZE, height: SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
})
  .composite([{ input: emblemFg, gravity: "center" }])
  .png()
  .toFile(path.join(OUT, "icon-foreground.png"));
console.log("✓ assets/icon-foreground.png");

await sharp(bg).png().toFile(path.join(OUT, "icon-background.png"));
console.log("✓ assets/icon-background.png");
