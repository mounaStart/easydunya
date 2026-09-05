#!/usr/bin/env node
/**
 * Étape 1 — Créer un voyage test.
 *
 * Usage:
 *   npm run test:e2e:create
 *   npm run test:e2e:create -- --from=nouakchott --to=arafat
 *   npm run test:e2e:create -- --from=nouakchott --to=tevragh
 */
import { getRouteFromArgs } from "../lib/e2e-args.mjs";
import {
  findCityIds,
  loginDriver,
  STATE_PATH,
  writeState,
} from "../lib/e2e-client.mjs";

async function main() {
  const { from: fromName, to: toName } = getRouteFromArgs();

  console.log("══════════════════════════════════════════");
  console.log(` E2E 1/4 — Créer voyage ${fromName} → ${toName}`);
  console.log("══════════════════════════════════════════\n");

  const { supabase, userId } = await loginDriver();
  console.log(`✓ Chauffeur connecté: ${userId}`);

  const { from, to } = await findCityIds(supabase, fromName, toName);
  console.log(`✓ Trajet: ${from.name_fr} → ${to.name_fr}`);

  const { data: cityPrice } = await supabase
    .from("city_prices")
    .select("id, price_per_seat, distance_km")
    .eq("from_city_id", from.id)
    .eq("to_city_id", to.id)
    .maybeSingle();

  const price = cityPrice?.price_per_seat ?? 200;
  const distanceKm = cityPrice?.distance_km ?? 10;
  const departAt = new Date();
  departAt.setMinutes(departAt.getMinutes() + 30, 0, 0);

  const { data: trip, error } = await supabase
    .from("trips")
    .insert({
      driver_id: userId,
      from_city_id: from.id,
      to_city_id: to.id,
      depart_at: departAt.toISOString(),
      price_per_seat: price,
      seats_total: 8,
      seats_available: 8,
      status: "scheduled",
      city_price_id: cityPrice?.id ?? null,
      distance_km: distanceKm,
      notes: `Voyage test E2E ${from.name_fr} → ${to.name_fr}`,
    })
    .select("id, status, depart_at, price_per_seat")
    .single();

  if (error) {
    console.error("❌ Création voyage:", error.message);
    process.exit(1);
  }

  writeState({
    tripId: trip.id,
    fromCity: from.name_fr,
    toCity: to.name_fr,
    fromLat: from.latitude,
    fromLng: from.longitude,
    toLat: to.latitude,
    toLng: to.longitude,
    status: trip.status,
    step: "created",
  });

  console.log("\n✅ Voyage créé");
  console.log(`   ID:     ${trip.id}`);
  console.log(`   Statut: ${trip.status}`);
  console.log(`   Prix:   ${trip.price_per_seat} MRU / place`);
  console.log(`   Dist:   ~${distanceKm} km`);
  console.log(`   État:   ${STATE_PATH}`);
  console.log("\n➡️  Prochaine étape: npm run test:e2e:start\n");

  await supabase.auth.signOut();
}

main().catch((err) => {
  console.error("❌", err.message);
  process.exit(1);
});
