// Génère les icônes Easy Dunya : fond blanc + emblème centré et grand (style Authenticator).
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "public", "brand", "emblem.png");
const ASSETS = path.join(ROOT, "assets");
const PUBLIC_ICONS = path.join(ROOT, "public", "icons");
const SIZE = 1024;
const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };

/** Remplissage du carré après rognage des marges blanches de l’emblème. */
const FILL_LAUNCHER = 0.94;
const FILL_ADAPTIVE = 0.88;
const FILL_WEB = 0.9;

fs.mkdirSync(ASSETS, { recursive: true });
fs.mkdirSync(PUBLIC_ICONS, { recursive: true });

async function whiteSquare(size = SIZE) {
  return sharp({
    create: { width: size, height: size, channels: 4, background: WHITE },
  })
    .png()
    .toBuffer();
}

/** Rogne les marges blanches puis retire le fond blanc restant (alpha). */
async function emblemLayer(boxPx) {
  const { data, info } = await sharp(SRC)
    .ensureAlpha()
    .trim({ threshold: 12 })
    .resize(boxPx, boxPx, { fit: "inside", withoutEnlargement: false })
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

async function composeWhiteIcon(size, fillRatio) {
  const bg = await whiteSquare(size);
  const emblem = await emblemLayer(Math.round(size * fillRatio));
  return sharp(bg).composite([{ input: emblem, gravity: "center" }]).png().toBuffer();
}

const bg = await whiteSquare();

const emblemLauncher = await emblemLayer(Math.round(SIZE * FILL_LAUNCHER));
await sharp(bg)
  .composite([{ input: emblemLauncher, gravity: "center" }])
  .png()
  .toFile(path.join(ASSETS, "icon-only.png"));
console.log("✓ assets/icon-only.png");

const emblemAdaptive = await emblemLayer(Math.round(SIZE * FILL_ADAPTIVE));
await sharp({
  create: { width: SIZE, height: SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
})
  .composite([{ input: emblemAdaptive, gravity: "center" }])
  .png()
  .toFile(path.join(ASSETS, "icon-foreground.png"));
console.log("✓ assets/icon-foreground.png");

await sharp(bg).png().toFile(path.join(ASSETS, "icon-background.png"));
console.log("✓ assets/icon-background.png");

for (const size of [192, 512]) {
  const buf = await composeWhiteIcon(size, FILL_WEB);
  const out = path.join(PUBLIC_ICONS, `icon-${size}.png`);
  fs.writeFileSync(out, buf);
  console.log(`✓ public/icons/icon-${size}.png (${buf.length} bytes)`);
}
