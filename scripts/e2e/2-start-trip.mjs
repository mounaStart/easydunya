#!/usr/bin/env node
/**
 * Étape 2 — Démarrer le voyage créé (in_progress).
 *
 * Usage: npm run test:e2e:start
 */
import {
  fetchTrip,
  loginDriver,
  releaseDriverLock,
  requireTripId,
  writeState,
} from "../lib/e2e-client.mjs";

async function main() {
  console.log("══════════════════════════════════════════");
  console.log(" E2E 2/4 — Démarrer le voyage");
  console.log("══════════════════════════════════════════\n");

  const tripId = requireTripId();
  const { supabase, userId } = await loginDriver();

  console.log("⏳ Vérification verrou chauffeur…");
  await releaseDriverLock(supabase, userId, tripId);

  const before = await fetchTrip(supabase, tripId);
  if (!before) {
    console.error("❌ Voyage introuvable:", tripId);
    process.exit(1);
  }
  console.log(`Voyage ${tripId} — statut actuel: ${before.status}`);

  if (before.status === "in_progress") {
    console.log("\n⚠️  Déjà en cours — rien à faire.");
    writeState({ status: "in_progress", step: "started" });
    console.log("\n➡️  Prochaine étape: npm run test:e2e:gps-aleg\n");
    await supabase.auth.signOut();
    return;
  }

  if (before.status !== "scheduled") {
    console.error(`❌ Impossible de démarrer (statut: ${before.status})`);
    process.exit(1);
  }

  const { error } = await supabase.rpc("driver_start_trip", { p_trip_id: tripId });
  if (error) {
    console.error("❌ driver_start_trip:", error.message);
    process.exit(1);
  }

  const after = await fetchTrip(supabase, tripId);
  writeState({ status: after?.status, step: "started" });

  console.log("\n✅ Voyage démarré");
  console.log(`   Statut: ${after?.status}`);
  console.log("\n➡️  Prochaine étape: npm run test:e2e:gps-aleg\n");

  await supabase.auth.signOut();
}

main().catch((err) => {
  console.error("❌", err.message);
  process.exit(1);
});
