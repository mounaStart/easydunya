// Génère les sources d'icônes (1024x1024) pour @capacitor/assets à partir
// de l'emblème Easy Dunya (public/brand/emblem.png).
// Utilise sharp (fourni par @capacitor/assets).
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "public", "brand", "emblem.png");
const OUT = path.join(ROOT, "assets");
fs.mkdirSync(OUT, { recursive: true });

const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };
const TRANSPARENT = { r: 255, g: 255, b: 255, alpha: 0 };

async function squareWith(innerSize, bg, outFile) {
  const inner = await sharp(SRC)
    .resize({ width: innerSize, height: innerSize, fit: "contain", background: WHITE })
    .png()
    .toBuffer();
  await sharp({
    create: { width: 1024, height: 1024, channels: 4, background: bg },
  })
    .composite([{ input: inner, gravity: "center" }])
    .png()
    .toFile(path.join(OUT, outFile));
  console.log(`✓ assets/${outFile}`);
}

// Icône legacy (carré plein) : emblème centré sur blanc
await squareWith(920, WHITE, "icon-only.png");
// Icône adaptative — premier plan dans la zone de sécurité (~62%)
await squareWith(640, TRANSPARENT, "icon-foreground.png");
// Icône adaptative — fond blanc
await sharp({
  create: { width: 1024, height: 1024, channels: 4, background: WHITE },
})
  .png()
  .toFile(path.join(OUT, "icon-background.png"));
console.log("✓ assets/icon-background.png");
