/** Client Supabase + état partagé pour les scripts E2E chauffeur. */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadDotEnv } from "./route-math.mjs";
import { resolveCityLabel } from "./e2e-args.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));
export const STATE_PATH = join(__dir, "..", ".e2e-trip-state.json");

export function phoneToEmail(raw) {
  const digits = String(raw).replace(/\D/g, "").replace(/^222/, "");
  return `${digits}@phone.easydunya.app`;
}

export function requireEnv() {
  loadDotEnv();
  const url = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const phone = process.env.TEST_DRIVER_PHONE;
  const password = process.env.TEST_DRIVER_PASSWORD;

  if (!url || !anonKey) {
    throw new Error("VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY requis dans .env");
  }
  if (!phone || !password) {
    throw new Error("TEST_DRIVER_PHONE et TEST_DRIVER_PASSWORD requis dans .env");
  }
  return { url, anonKey, phone, password };
}

export async function loginDriver() {
  const { url, anonKey, phone, password } = requireEnv();
  const supabase = createClient(url, anonKey);
  const { data, error } = await supabase.auth.signInWithPassword({
    email: phoneToEmail(phone),
    password,
  });
  if (error) throw new Error(`Connexion chauffeur: ${error.message}`);
  return { supabase, userId: data.user.id };
}

export function readState() {
  if (!existsSync(STATE_PATH)) return {};
  try {
    return JSON.parse(readFileSync(STATE_PATH, "utf8"));
  } catch {
    return {};
  }
}

export function writeState(patch) {
  const state = { ...readState(), ...patch, updatedAt: new Date().toISOString() };
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), "utf8");
  return state;
}

export function requireTripId() {
  const { tripId } = readState();
  if (!tripId) {
    throw new Error(
      "tripId manquant. Lancez d'abord: npm run test:e2e:create"
    );
  }
  return tripId;
}

export async function findCityIds(supabase, fromName, toName) {
  const fromLabel = resolveCityLabel(fromName);
  const toLabel = resolveCityLabel(toName);

  const { data, error } = await supabase
    .from("cities")
    .select("id, name_fr, latitude, longitude")
    .in("name_fr", [fromLabel, toLabel]);
  if (error) throw new Error(error.message);

  let from = data?.find((c) => c.name_fr === fromLabel);
  let to = data?.find((c) => c.name_fr === toLabel);

  if (!from) {
    const { data: fuzzy } = await supabase
      .from("cities")
      .select("id, name_fr, latitude, longitude")
      .ilike("name_fr", `%${fromLabel}%`)
      .limit(1);
    from = fuzzy?.[0];
  }
  if (!to) {
    const { data: fuzzy } = await supabase
      .from("cities")
      .select("id, name_fr, latitude, longitude")
      .ilike("name_fr", `%${toLabel}%`)
      .limit(1);
    to = fuzzy?.[0];
  }

  if (!from || !to) {
    throw new Error(
      `Villes introuvables: ${fromLabel} / ${toLabel}. ` +
        "Appliquez la migration 0038_nouakchott_quartiers.sql sur Supabase."
    );
  }
  return { from, to };
}

export async function fetchTrip(supabase, tripId) {
  const { data, error } = await supabase
    .from("trips_public")
    .select("*")
    .eq("id", tripId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/** Termine les voyages in_progress qui bloquent le chauffeur (tests E2E). */
export async function releaseDriverLock(supabase, userId, exceptTripId = null) {
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("current_trip_id")
    .eq("id", userId)
    .maybeSingle();
  if (profileErr) throw new Error(profileErr.message);

  const lockedId = profile?.current_trip_id;
  if (!lockedId || lockedId === exceptTripId) {
    const { data: stale } = await supabase
      .from("trips")
      .select("id, status, from_city_id, to_city_id")
      .eq("driver_id", userId)
      .eq("status", "in_progress");
    if (!stale?.length) return [];

    const ended = [];
    for (const t of stale) {
      if (t.id === exceptTripId) continue;
      console.log(`⚠️  Voyage bloquant détecté: ${t.id} (${t.status})`);
      const { error } = await supabase.rpc("driver_end_trip", { p_trip_id: t.id });
      if (error) throw new Error(`driver_end_trip(${t.id}): ${error.message}`);
      ended.push(t.id);
      console.log(`   → Terminé: ${t.id}`);
    }
    return ended;
  }

  const locked = await fetchTrip(supabase, lockedId);
  if (locked?.status === "in_progress" && lockedId !== exceptTripId) {
    console.log(`⚠️  Chauffeur verrouillé sur: ${lockedId}`);
    const { error } = await supabase.rpc("driver_end_trip", { p_trip_id: lockedId });
    if (error) throw new Error(`driver_end_trip(${lockedId}): ${error.message}`);
    console.log(`   → Voyage précédent terminé.`);
    return [lockedId];
  }

  if (locked?.status !== "in_progress") {
    await supabase.from("profiles").update({ current_trip_id: null }).eq("id", userId);
  }

  return [];
}
