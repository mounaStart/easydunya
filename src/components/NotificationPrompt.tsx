import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { subscribeToPush, getPushState, type PushState } from "../lib/push";
import { isNativePlatform } from "../lib/nativePush";
import { onLocationPromptSettled } from "../lib/startupPrompts";

const SNOOZE_KEY = "ed_notif_snooze_until";
const SNOOZE_MS = 1000 * 60 * 60 * 24; // 24 h

function snoozed(): boolean {
  try {
    const until = Number(localStorage.getItem(SNOOZE_KEY) ?? "0");
    return Date.now() < until;
  } catch {
    return false;
  }
}

/**
 * Notifications : une seule demande, après le GPS.
 * Sur APK → boîte système Android directement (pas de bannière intermédiaire).
 */
export default function NotificationPrompt() {
  const { user } = useAuth();
  const [state, setState] = useState<PushState>("on");
  const [busy, setBusy] = useState(false);
  const [hidden, setHidden] = useState(snoozed());
  const [error, setError] = useState<string | null>(null);
  const [locationReady, setLocationReady] = useState(false);
  const nativeRequested = useRef(false);

  const refresh = useCallback(async () => {
    if (!user) return;
    if (
      isNativePlatform() ||
      (typeof Notification !== "undefined" &&
        Notification.permission === "granted")
    ) {
      const st = await getPushState(user.id);
      if (st === "off") await subscribeToPush(user.id);
    }
    setState(await getPushState(user.id));
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    setLocationReady(false);
    return onLocationPromptSettled(() => setLocationReady(true));
  }, [user?.id]);

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") refresh();
    }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [refresh]);

  // APK : une seule boîte système, après la localisation
  useEffect(() => {
    if (!user || hidden || !locationReady || nativeRequested.current) return;
    if (!isNativePlatform() || state !== "off") return;

    nativeRequested.current = true;
    subscribeToPush(user.id)
      .then((ok) => refresh().then(() => ok))
      .then((ok) => {
        if (ok) setHidden(true);
      })
      .catch(() => {});
  }, [user, hidden, locationReady, state, refresh]);

  if (!user || hidden || !locationReady) return null;
  if (state !== "off") return null;
  if (isNativePlatform()) return null;

  async function enable() {
    if (!user || busy) return;
    setBusy(true);
    setError(null);
    try {
      const ok = await subscribeToPush(user.id);
      await refresh();
      if (ok) {
        setHidden(true);
        return;
      }
      if (typeof Notification !== "undefined" && Notification.permission === "denied") {
        setHidden(true);
        return;
      }
      setError(
        "Impossible d'activer les notifications. Vérifiez que VITE_VAPID_PUBLIC_KEY est configuré, puis réessayez."
      );
    } catch {
      setError("Une erreur est survenue. Réessayez dans un instant.");
    } finally {
      setBusy(false);
    }
  }

  function later() {
    try {
      localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS));
    } catch {
      /* ignore */
    }
    setHidden(true);
  }

  return (
    <div className="fixed inset-x-0 bottom-20 z-50 px-3 sm:bottom-6">
      <div className="mx-auto max-w-md rounded-2xl bg-white shadow-xl ring-1 ring-slate-200 p-4">
        <div className="flex items-start gap-3">
          <span className="shrink-0 w-10 h-10 rounded-full bg-brand-50 text-brand-600 inline-flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.7 21a2 2 0 0 1-3.4 0" />
            </svg>
          </span>
          <div className="min-w-0">
            <div className="font-bold text-ink">Activer les notifications</div>
            <p className="text-sm text-slate-500 mt-0.5">
              Soyez prévenu des réservations, confirmations et départs — même
              quand l'application est fermée.
            </p>
          </div>
        </div>
        {error && (
          <p className="mt-2 text-sm text-rose-600 bg-rose-50 rounded-xl px-3 py-2">
            {error}
          </p>
        )}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={later}
            disabled={busy}
            className="inline-flex items-center justify-center rounded-2xl px-4 py-3 font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition"
          >
            Plus tard
          </button>
          <button
            type="button"
            onClick={enable}
            disabled={busy}
            className="inline-flex items-center justify-center rounded-2xl px-4 py-3 font-semibold text-white bg-brand-600 hover:bg-brand-700 transition disabled:opacity-60"
          >
            {busy ? "Activation…" : "Autoriser"}
          </button>
        </div>
      </div>
    </div>
  );
}
