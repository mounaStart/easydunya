// =====================================================================
// Génère les icônes PWA/APK carrées (fond blanc, logo centré) à partir
// d'une image source (par défaut le logo Easy Dunya fourni).
//
// Utilisation :
//   1) npm i -D sharp        (si pas déjà installé)
//   2) node scripts/make-icons.mjs [chemin/vers/logo.png]
//
// Produit :
//   public/icons/icon-192.png   (192x192, "any")
//   public/icons/icon-512.png   (512x512, "any" + maskable)
//   public/brand/logo.png       (512x512, utilisé ailleurs si besoin)
// =====================================================================
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const DEFAULT_SRC =
  "C:/Users/pc/.cursor/projects/c-Projets-EASYDUNYA1/assets/c__Users_pc_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_logo-0e091d14-f1ca-48c0-97d9-45b992567355.png";

const src = process.argv[2] ? resolve(process.argv[2]) : DEFAULT_SRC;

const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };

async function makeIcon(size, out, paddingRatio = 0.12) {
  const inner = Math.round(size * (1 - paddingRatio * 2));
  const logo = await sharp(src)
    .resize(inner, inner, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .toBuffer();

  await sharp({
    create: { width: size, height: size, channels: 4, background: WHITE },
  })
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toFile(out);

  console.log("✓", out);
}

async function run() {
  mkdirSync("public/icons", { recursive: true });
  mkdirSync("public/brand", { recursive: true });

  await makeIcon(192, "public/icons/icon-192.png", 0.1);
  await makeIcon(512, "public/icons/icon-512.png", 0.12);
  await makeIcon(512, "public/brand/logo.png", 0.12);

  console.log("\nIcônes générées depuis:", src);
}

run().catch((e) => {
  console.error("Erreur:", e.message);
  console.error("Astuce: installez sharp avec  npm i -D sharp");
  process.exit(1);
});
