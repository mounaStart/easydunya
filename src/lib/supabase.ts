import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const keyLooksPlaceholder =
  !key ||
  key.includes("COLLEZ") ||
  key.includes("missing") ||
  key.length < 20;

if (!url || keyLooksPlaceholder) {
  console.warn(
    "[Easy Dunya] VITE_SUPABASE_URL et/ou VITE_SUPABASE_ANON_KEY manquent ou invalides. Supabase → Settings → API → copiez Project URL + anon public dans .env, puis relancez npm run dev."
  );
}

export const supabase = createClient(
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
