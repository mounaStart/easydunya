#!/usr/bin/env node
/**
 * Simulation complète: le chauffeur avance le long de la route
 * jusqu'à ce que la fin de voyage soit autorisée (≤ 500 m).
 *
 * Usage:
 *   npm run test:trip-end
 *   npm run test:trip-end -- --steps=40
 */
import {
  CITIES,
  fetchOsrmRoute,
  formatM,
  pointAtProgress,
  tripRemainingM,
} from "./lib/route-math.mjs";

const END_TRIP_RADIUS_M = 500;

function stepsArg() {
  const hit = process.argv.find((a) => a.startsWith("--steps="));
  if (!hit) return 30;
  return Math.max(5, parseInt(hit.split("=")[1], 10) || 30);
}

async function main() {
  const from = CITIES.nouakchott;
  const to = CITIES.aleg;
  const steps = stepsArg();

  console.log("═══════════════════════════════════════════════════════");
  console.log(" Simulation avancement chauffeur — Nouakchott → Aleg");
  console.log("═══════════════════════════════════════════════════════\n");

  const route = await fetchOsrmRoute(from, to);
  console.log(`Route totale: ${formatM(route.distanceM)}\n`);
  console.log("Progression | Restant    | Fin voyage?");
  console.log("------------|------------|------------");

  let firstEndStep = null;

  for (let i = 0; i <= steps; i++) {
    const progress = i / steps;
    const driver = pointAtProgress(route.geometry, progress);
    const remaining = tripRemainingM(route.geometry, from, to, driver);
    const canEnd = remaining <= END_TRIP_RADIUS_M;
    if (canEnd && firstEndStep === null) firstEndStep = progress;

    const pct = `${Math.round(progress * 100)}%`.padStart(4);
    const rem = formatM(remaining).padStart(10);
    const flag = canEnd ? "✅ OUI" : "   —";
    console.log(`${pct}       | ${rem} | ${flag}`);
  }

  console.log("\n───────────────────────────────────────────────────────");
  if (firstEndStep != null) {
    console.log(
      `✅ Fin de voyage possible dès ~${Math.round(firstEndStep * 100)} % du trajet`
    );
    console.log(`   (≈ ${formatM(route.distanceM * (1 - firstEndStep))} avant la fin)`);
  } else {
    console.log("❌ Fin de voyage jamais débloquée sur cette simulation — à investiguer.");
  }
  console.log("───────────────────────────────────────────────────────\n");
}

main().catch((err) => {
  console.error("❌", err.message);
  process.exit(1);
});
