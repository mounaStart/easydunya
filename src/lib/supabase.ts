import { createClient } from "@supabase/supabase-js";

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const rawKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ?? "";

/** Clé anon valide (JWT Supabase, ~200+ caractères). */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    url &&
      rawKey.length >= 20 &&
      !rawKey.includes("COLLEZ") &&
      !rawKey.includes("missing")
  );
}

const supabaseAnonKey = isSupabaseConfigured()
  ? rawKey
  : "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXseIn0.placeholder";

if (!isSupabaseConfigured()) {
  console.warn(
    "[Easy Dunya] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY manquants — ajoutez-les dans GitHub Secrets (APK) ou .env (dev)."
  );
}

export const supabase = createClient(
  url ?? "https://prfmqfnaqtmyfyxqjeli.supabase.co",
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
    realtime: { params: { eventsPerSecond: 5 } },
  }
);
