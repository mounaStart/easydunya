#!/usr/bin/env node
/**
 * Enchaîne les 4 étapes E2E pour un trajet (--from / --to).
 *
 * Usage:
 *   npm run test:e2e:route -- --from=nouakchott --to=arafat
 *   npm run test:e2e:nkc-arafat
 *   npm run test:e2e:nkc-tevragh
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { getRouteFromArgs } from "../lib/e2e-args.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, "..", "..");

const { from, to } = getRouteFromArgs();
const extraArgs = process.argv.filter((a) => a.startsWith("--"));

const steps = [
  ["0-cleanup-driver.mjs", "Libérer chauffeur"],
  ["1-create-trip.mjs", "Créer voyage"],
  ["2-start-trip.mjs", "Démarrer"],
  ["3-position-driver-dest.mjs", "GPS destination"],
  ["4-verify-end-trip.mjs", "Vérifier / terminer"],
];

function run(script) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [join(__dir, script), ...extraArgs], {
      cwd: root,
      stdio: "inherit",
      env: { ...process.env, E2E_FROM: from, E2E_TO: to },
    });
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${script} exit ${code}`));
    });
  });
}

async function main() {
  console.log("══════════════════════════════════════════");
  console.log(` E2E COMPLET — ${from} → ${to}`);
  console.log("══════════════════════════════════════════\n");

  for (const [script, label] of steps) {
    console.log(`\n########## ${label} ##########\n`);
    await run(script);
  }

  console.log(`\n🎉 Test ${from} → ${to} terminé avec succès.\n`);
}

main().catch((err) => {
  console.error("\n❌ E2E interrompu:", err.message);
  process.exit(1);
});
