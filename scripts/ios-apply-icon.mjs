/** Copie le logo Easy Dunya dans AppIcon iOS (remplace l’icône Capacitor par défaut). */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const destDir = path.join(root, "ios/App/App/Assets.xcassets/AppIcon.appiconset");
const sources = [
  path.join(root, "assets/icon-only.png"),
  path.join(root, "public/icons/icon-512.png"),
  path.join(root, "public/brand/emblem.png"),
];

const src = sources.find((p) => fs.existsSync(p));
if (!src || !fs.existsSync(destDir)) {
  console.error("ios-apply-icon: source ou dossier AppIcon introuvable");
  process.exit(1);
}

fs.mkdirSync(destDir, { recursive: true });

const sizes = [
  ["AppIcon-20@2x.png", 40],
  ["AppIcon-20@3x.png", 60],
  ["AppIcon-29@2x.png", 58],
  ["AppIcon-29@3x.png", 87],
  ["AppIcon-40@2x.png", 80],
  ["AppIcon-40@3x.png", 120],
  ["AppIcon-60@2x.png", 120],
  ["AppIcon-60@3x.png", 180],
  ["AppIcon-512@2x.png", 1024],
];

for (const [name, px] of sizes) {
  await sharp(src).resize(px, px).png().toFile(path.join(destDir, name));
}

const contents = {
  images: [
    { idiom: "iphone", size: "20x20", scale: "2x", filename: "AppIcon-20@2x.png" },
    { idiom: "iphone", size: "20x20", scale: "3x", filename: "AppIcon-20@3x.png" },
    { idiom: "iphone", size: "29x29", scale: "2x", filename: "AppIcon-29@2x.png" },
    { idiom: "iphone", size: "29x29", scale: "3x", filename: "AppIcon-29@3x.png" },
    { idiom: "iphone", size: "40x40", scale: "2x", filename: "AppIcon-40@2x.png" },
    { idiom: "iphone", size: "40x40", scale: "3x", filename: "AppIcon-40@3x.png" },
    { idiom: "iphone", size: "60x60", scale: "2x", filename: "AppIcon-60@2x.png" },
    { idiom: "iphone", size: "60x60", scale: "3x", filename: "AppIcon-60@3x.png" },
    { idiom: "ios-marketing", size: "1024x1024", scale: "1x", filename: "AppIcon-512@2x.png" },
    { idiom: "universal", size: "1024x1024", filename: "AppIcon-512@2x.png", platform: "ios" },
  ],
  info: { author: "xcode", version: 1 },
};

fs.writeFileSync(path.join(destDir, "Contents.json"), JSON.stringify(contents, null, 2) + "\n");
console.log("✓ icônes iOS Easy Dunya écrites dans AppIcon.appiconset");
