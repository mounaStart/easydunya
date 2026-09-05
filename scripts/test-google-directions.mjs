#!/usr/bin/env node
/**
 * Test Edge Function directions (Google Directions via Supabase).
 *
 * Usage:
 *   npm run test:directions
 *   npm run test:directions -- --from=aleg --to=nouakchott
 */
import { createClient } from "@supabase/supabase-js";
import { CITIES, formatM, loadDotEnv } from "./lib/route-math.mjs";

function argCity(name, fallback) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!hit) return fallback;
  const key = hit.split("=")[1]?.toLowerCase();
  return CITIES[key] ?? fallback;
}

async function main() {
  loadDotEnv();

  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error("❌ VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY requis dans .env");
    process.exit(1);
  }

  const from = argCity("from", CITIES.aleg);
  const to = argCity("to", CITIES.nouakchott);

  console.log("══════════════════════════════════════════");
  console.log(" Test Google Directions (Edge Function)");
  console.log("══════════════════════════════════════════");
  console.log(`Supabase: ${url}`);
  console.log(`Trajet:   ${from.name} → ${to.name}`);
  console.log(`From:     ${from.lat}, ${from.lng}`);
  console.log(`To:       ${to.lat}, ${to.lng}\n`);

  const supabase = createClient(url, key);

  const { data, error } = await supabase.functions.invoke("directions", {
    body: {
      from: { lat: from.lat, lng: from.lng },
      to: { lat: to.lat, lng: to.lng },
    },
  });

  if (error) {
    console.error("❌ Invoke error:", error.message);
    if (data && typeof data === "object") {
      console.error("   Détail:", JSON.stringify(data, null, 2));
    } else {
      const url = process.env.VITE_SUPABASE_URL;
      const key = process.env.VITE_SUPABASE_ANON_KEY;
      try {
        const res = await fetch(`${url}/functions/v1/directions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: { lat: from.lat, lng: from.lng },
            to: { lat: to.lat, lng: to.lng },
          }),
        });
        console.error(`   HTTP ${res.status}:`, await res.text());
      } catch {
        /* ignore */
      }
    }
    console.error("\n→ Secret: supabase secrets set GOOGLE_MAPS_API_KEY=AIzaSy...");
    if (String(data?.error ?? "").includes("referer")) {
      console.error("→ Cette clé a des referrers HTTP : créez une 2e clé Google SANS sites web");
      console.error("  (Application restrictions = None, API = Directions API only)");
    } else {
      console.error("→ Google Cloud : activer Directions API, clé sans restriction referrer");
    }
    process.exit(1);
  }

  console.log("Réponse:", JSON.stringify(data, null, 2));

  if (data?.error) {
    console.error("\n❌ Google Directions:", data.error);
    if (data.status) console.error("   Status:", data.status);
    process.exit(1);
  }

  if (!data?.polyline || !Number.isFinite(data.distanceM)) {
    console.error("\n❌ Réponse incomplète (polyline ou distanceM manquant)");
    process.exit(1);
  }

  console.log("\n✅ Google Directions OK");
  console.log(`   Distance: ${formatM(data.distanceM)} (${data.distanceM} m)`);
  console.log(`   Durée:    ${Math.round((data.durationS ?? 0) / 60)} min`);
  console.log(`   Provider: ${data.provider ?? "google"}`);
  console.log(`   Polyline: ${data.polyline.length} caractères`);
}

main().catch((err) => {
  console.error("❌", err.message);
  process.exit(1);
});
