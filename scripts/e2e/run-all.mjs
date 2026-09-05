#!/usr/bin/env node
/**
 * Enchaîne les 4 étapes E2E.
 * Usage: npm run test:e2e:all
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, "..", "..");

const steps = [
  ["0-cleanup-driver.mjs", "Libérer chauffeur"],
  ["1-create-trip.mjs", "Créer voyage"],
  ["2-start-trip.mjs", "Démarrer"],
  ["3-position-driver-dest.mjs", "GPS destination"],
  ["4-verify-end-trip.mjs", "Vérifier / terminer"],
];

function run(script) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [join(__dir, script)], {
      cwd: root,
      stdio: "inherit",
      shell: false,
    });
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${script} exit ${code}`));
    });
  });
}

async function main() {
  console.log("══════════════════════════════════════════");
  console.log(" E2E COMPLET — 4 étapes");
  console.log("══════════════════════════════════════════\n");

  for (const [script, label] of steps) {
    console.log(`\n########## ${label} ##########\n`);
    await run(script);
  }

  console.log("\n🎉 E2E terminé avec succès.\n");
}

main().catch((err) => {
  console.error("\n❌ E2E interrompu:", err.message);
  process.exit(1);
});
