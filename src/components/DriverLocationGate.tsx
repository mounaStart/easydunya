import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";
import {
  queryLocationPermission,
  requestAppLocation,
  type LocationFailReason,
} from "../lib/locationPermission";
import { signalLocationPromptSettled } from "../lib/startupPrompts";

function reasonMessage(reason: LocationFailReason, t: (k: string) => string): string {
  switch (reason) {
    case "denied":
      return t("locationPrompt.denied");
    case "timeout":
      return t("locationPrompt.timeout");
    case "disabled":
      return t("locationPrompt.disabled");
    default:
      return t("locationPrompt.unavailable");
  }
}

/**
 * Écran bloquant pour les chauffeurs approuvés : GPS obligatoire (Accepter / Refuser).
 * Tant que gps_consent !== true, le reste de l'app est inaccessible.
 */
export default function DriverLocationGate() {
  const { t } = useTranslation();
  const { user, profile, isDriver, mustChangePassword, refreshProfile } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [awaitingSettingsReturn, setAwaitingSettingsReturn] = useState(false);

  const isApprovedDriver =
    isDriver && profile?.role === "driver" && profile.driver_status === "approved";
  const refused = profile?.gps_consent === false;
  const needsGate =
    Boolean(user && isApprovedDriver && !mustChangePassword && profile?.gps_consent !== true);

  const acceptGps = useCallback(async () => {
    if (!user || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await requestAppLocation({ openSettingsIfDisabled: true });
      if (!result.ok) {
        if (result.reason === "disabled") {
          setAwaitingSettingsReturn(Boolean(result.openedSettings));
          setError(
            result.openedSettings
              ? t("locationPrompt.settingsOpened")
              : t("locationPrompt.disabled")
          );
          return;
        }
        setError(reasonMessage(result.reason, t));
        return;
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ gps_consent: true })
        .eq("id", user.id);
      if (updateError) {
        setError(updateError.message);
        return;
      }
      await refreshProfile();
      signalLocationPromptSettled();
    } catch {
      setError(t("locationPrompt.unavailable"));
    } finally {
      setBusy(false);
    }
  }, [user, busy, refreshProfile, t]);

  const refuseGps = useCallback(async () => {
    if (!user || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ gps_consent: false })
        .eq("id", user.id);
      if (updateError) {
        setError(updateError.message);
        return;
      }
      await refreshProfile();
    } finally {
      setBusy(false);
    }
  }, [user, busy, refreshProfile]);

  useEffect(() => {
    if (!needsGate) signalLocationPromptSettled();
  }, [needsGate]);

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState !== "visible" || !needsGate || busy) return;
      void queryLocationPermission().then((perm) => {
        if (perm === "granted" && awaitingSettingsReturn) {
          void acceptGps();
        }
      });
    }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [needsGate, busy, awaitingSettingsReturn, acceptGps]);

  if (!needsGate) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="mx-auto w-full max-w-md rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200 p-6">
        <div className="flex items-start gap-3">
          <span className="shrink-0 w-12 h-12 rounded-full bg-brand-50 text-brand-600 inline-flex items-center justify-center text-xl">
            📍
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-extrabold text-ink">
              {refused ? t("locationPrompt.driverRefusedTitle") : t("locationPrompt.driverGateTitle")}
            </h2>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">
              {refused ? t("locationPrompt.driverRefusedBody") : t("locationPrompt.driverGateBody")}
            </p>
          </div>
        </div>

        {error && (
          <p className="mt-4 text-sm text-rose-600 bg-rose-50 rounded-xl px-3 py-2">{error}</p>
        )}

        <div className="mt-5 grid grid-cols-2 gap-2">
          {!refused && (
            <button
              type="button"
              onClick={() => void refuseGps()}
              disabled={busy}
              className="inline-flex items-center justify-center rounded-2xl px-4 py-3.5 font-semibold text-rose-700 bg-rose-50 ring-1 ring-rose-200 hover:bg-rose-100 transition disabled:opacity-60"
            >
              {t("locationPrompt.refuse")}
            </button>
          )}
          <button
            type="button"
            onClick={() => void acceptGps()}
            disabled={busy}
            className={`inline-flex items-center justify-center rounded-2xl px-4 py-3.5 font-semibold text-white bg-brand-600 hover:bg-brand-700 transition disabled:opacity-60 ${
              refused ? "col-span-2" : ""
            }`}
          >
            {busy ? t("locationPrompt.enabling") : t("locationPrompt.accept")}
          </button>
        </div>
      </div>
    </div>
  );
}
