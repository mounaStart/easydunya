import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !key) {
  // En dev on log uniquement — l'app continue avec un client factice (les requêtes échoueront avec un message clair)
  console.warn(
    "[Easy Dunya] VITE_SUPABASE_URL et/ou VITE_SUPABASE_ANON_KEY manquent. Copiez .env.example vers .env."
  );
}

export const supabase = createClient<Database>(
  url ?? "http://localhost:8000",
  key ?? "missing-anon-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
    realtime: { params: { eventsPerSecond: 5 } },
  }
);
