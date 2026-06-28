import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";
import { queryLocationPermission, requestAppLocation } from "../lib/locationPermission";
import { syncPassengerLocation } from "../lib/passengerLocation";
import { isValidQuartierLabel } from "../lib/geocode";
import { signalLocationPromptSettled } from "../lib/startupPrompts";

const SNOOZE_KEY = "ed_location_snooze_until";
const SNOOZE_MS = 1000 * 60 * 60 * 4; // 4 h

function snoozed(): boolean {
  try {
    const until = Number(localStorage.getItem(SNOOZE_KEY) ?? "0");
    return Date.now() < until;
  } catch {
    return false;
  }
}

/**
 * Au démarrage : vérifie si le GPS est activé, sinon propose l'activation
 * (passager et chauffeur), comme les applications de transport classiques.
 */
export default function LocationPrompt() {
  const { t } = useTranslation();
  const { user, profile, isDriver, refreshProfile } = useAuth();
  const [needsPrompt, setNeedsPrompt] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hidden, setHidden] = useState(snoozed());
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  const isPassenger = profile?.role === "passenger";
  const visible = Boolean(
    checked && user && !hidden && needsPrompt && (isPassenger || isDriver)
  );

  const refresh = useCallback(async () => {
    if (!user || hidden || (!isPassenger && !isDriver)) {
      setNeedsPrompt(false);
      setChecked(true);
      return;
    }

    const permission = await queryLocationPermission();
    if (permission === "unsupported") {
      setNeedsPrompt(false);
      setChecked(true);
      return;
    }
    if (permission === "denied") {
      setNeedsPrompt(true);
      setChecked(true);
      return;
    }
    if (permission === "granted") {
      if (isPassenger) {
        const hasQuartier =
          isValidQuartierLabel(profile?.quartier) &&
          profile?.location_lat != null &&
          profile?.location_lng != null;
        setNeedsPrompt(!hasQuartier);
        if (!hasQuartier && user) {
          await syncPassengerLocation(user.id, profile, { force: true });
          await refreshProfile();
        }
      } else {
        setNeedsPrompt(false);
      }
      setChecked(true);
      return;
    }

    setNeedsPrompt(true);
    setChecked(true);
  }, [user, hidden, isPassenger, isDriver, profile, refreshProfile]);

  useEffect(() => {
    setChecked(false);
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (checked && !visible) signalLocationPromptSettled();
  }, [checked, visible]);

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

  if (!visible) return null;

  async function enable() {
    if (!user || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await requestAppLocation();
      if (!result.ok) {
        setError(
          result.reason === "denied"
            ? t("locationPrompt.denied")
            : t("locationPrompt.unavailable")
        );
        if (result.reason === "denied") {
          setHidden(true);
          signalLocationPromptSettled();
        }
        return;
      }

      if (isPassenger) {
        await syncPassengerLocation(user.id, profile, { force: true });
        await refreshProfile();
      }

      setNeedsPrompt(false);
      setHidden(true);
      signalLocationPromptSettled();
    } catch {
      setError(t("locationPrompt.unavailable"));
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
    setNeedsPrompt(false);
    signalLocationPromptSettled();
  }

  const body = isDriver
    ? t("locationPrompt.driverBody")
    : t("locationPrompt.passengerBody");

  return (
    <div className="fixed inset-x-0 bottom-[9.5rem] z-50 px-3 md:bottom-6">
      <div className="mx-auto max-w-md rounded-2xl bg-white shadow-xl ring-1 ring-slate-200 p-4">
        <div className="flex items-start gap-3">
          <span className="shrink-0 w-10 h-10 rounded-full bg-brand-50 text-brand-600 inline-flex items-center justify-center">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 21s-7-5.2-7-11a7 7 0 0 1 14 0c0 5.8-7 11-7 11z" />
              <circle cx="12" cy="10" r="2.5" />
            </svg>
          </span>
          <div className="min-w-0">
            <div className="font-bold text-ink">{t("locationPrompt.title")}</div>
            <p className="text-sm text-slate-500 mt-0.5">{body}</p>
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
            {t("locationPrompt.later")}
          </button>
          <button
            type="button"
            onClick={enable}
            disabled={busy}
            className="inline-flex items-center justify-center rounded-2xl px-4 py-3 font-semibold text-white bg-brand-600 hover:bg-brand-700 transition disabled:opacity-60"
          >
            {busy ? t("locationPrompt.enabling") : t("locationPrompt.enable")}
          </button>
        </div>
      </div>
    </div>
  );
}
