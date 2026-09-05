import type { ReactNode } from "react";
import { isSupabaseConfigured } from "../lib/supabase";

/** Bloque l'app si Supabase n'est pas configuré (APK sans secret GitHub). */
export default function SupabaseConfigGate({ children }: { children: ReactNode }) {
  if (isSupabaseConfigured()) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="max-w-md w-full rounded-2xl bg-white border border-amber-200 shadow-lg p-5">
        <h1 className="text-lg font-bold text-amber-800">Configuration manquante</h1>
        <p className="mt-2 text-sm text-slate-600 leading-relaxed">
          La clé Supabase (<code className="text-xs">VITE_SUPABASE_ANON_KEY</code>) n&apos;est pas
          incluse dans cette APK.
        </p>
        <p className="mt-3 text-sm text-slate-600 leading-relaxed">
          GitHub → repo → <strong>Settings → Secrets → Actions</strong> → ajoutez{" "}
          <code className="text-xs">VITE_SUPABASE_ANON_KEY</code> (clé anon publique Supabase →
          Settings → API), puis relancez le workflow <strong>Build Android APK</strong>.
        </p>
      </div>
    </div>
  );
}
