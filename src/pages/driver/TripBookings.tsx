import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "../../lib/supabase";
import { cancelTripWithBroadcast, updateBookingStatus, useTripBookings } from "../../hooks/useBookings";
import { useDriverGps, useTripDriverPosition } from "../../hooks/useDriverGps";
import TrackingMap from "../../components/TrackingMap";
import { useAuth } from "../../hooks/useAuth";
import type { Booking, Profile, TripPublic } from "../../lib/types";
import Spinner from "../../components/Spinner";
import StatusBadge from "../../components/StatusBadge";
import {
  distanceKm,
  formatPrice,
  formatPeriod,
  relativeDateLabel,
} from "../../lib/utils";

// Rayon (en mètres) autour de la destination où le chauffeur peut terminer le voyage.
const END_TRIP_RADIUS_M = 500;

export default function TripBookings() {
  const { tripId } = useParams();
  const { t, i18n } = useTranslation();
  const { refreshProfile, role } = useAuth();
  const { bookings, loading, refresh } = useTripBookings(tripId);
  const [trip, setTrip] = useState<TripPublic | null>(null);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [busy, setBusy] = useState(false);
  const [lockMsg, setLockMsg] = useState<string | null>(null);

  const isInProgress = trip?.status === "in_progress";
  useDriverGps(tripId, isInProgress);
  const driverPos = useTripDriverPosition(tripId, isInProgress);

  const isAdmin = role === "admin";
  // Distance (m) entre la position actuelle du chauffeur et la destination
  const distanceToDestM =
    trip && driverPos
      ? distanceKm(driverPos.lat, driverPos.lng, trip.to_lat, trip.to_lng) * 1000
      : null;
  const nearDestination =
    distanceToDestM !== null && distanceToDestM <= END_TRIP_RADIUS_M;
  // L'admin peut toujours terminer ; le chauffeur seulement à proximité (≤500 m)
  const canEndTrip = isAdmin || nearDestination;

  useEffect(() => {
    if (!tripId) return;
    supabase
      .from("trips_public")
      .select("*")
      .eq("id", tripId)
      .maybeSingle()
      .then(({ data }) => setTrip((data as TripPublic | null) ?? null));
  }, [tripId]);

  useEffect(() => {
    const ids = bookings
      .map((b) => b.passenger_id)
      .filter((x): x is string => !!x);
    if (ids.length === 0) return;
    supabase
      .from("profiles")
      .select("*")
      .in("id", ids)
      .then(({ data }) => {
        const map: Record<string, Profile> = {};
        (data as Profile[] | null)?.forEach((p) => (map[p.id] = p));
        setProfiles(map);
      });
  }, [bookings]);

  async function reloadTrip() {
    if (!tripId) return;
    const { data } = await supabase
      .from("trips_public")
      .select("*")
      .eq("id", tripId)
      .maybeSingle();
    setTrip((data as TripPublic | null) ?? null);
  }

  async function setStatus(b: Booking, status: Booking["status"]) {
    await updateBookingStatus(b.id, status);
    refresh();
  }

  async function adjustSeats(delta: number) {
    if (!trip || !tripId) return;
    const next = trip.seats_available + delta;
    if (next < 0 || next > trip.seats_total) return;
    setBusy(true);
    setLockMsg(null);
    const { error } = await supabase
      .from("trips")
      .update({ seats_available: next })
      .eq("id", tripId);
    setBusy(false);
    if (error) {
      setLockMsg(error.message);
      return;
    }
    await reloadTrip();
  }

  async function startTrip() {
    if (!tripId) return;
    setBusy(true);
    setLockMsg(null);
    const { error } = await supabase.rpc("driver_start_trip", { p_trip_id: tripId });
    setBusy(false);
    if (error) {
      setLockMsg(error.message);
      return;
    }
    await reloadTrip();
    await refreshProfile();
  }

  async function cancelTrip() {
    if (!tripId) return;
    if (!confirm("Annuler ce voyage ? Les autres chauffeurs vers la même destination seront notifiés.")) return;
    setBusy(true);
    const { error } = await cancelTripWithBroadcast(tripId);
    setBusy(false);
    if (error) {
      setLockMsg(error);
      return;
    }
    await reloadTrip();
    await refreshProfile();
  }

  async function endTrip() {
    if (!tripId) return;
    setBusy(true);
    const { error } = await supabase.rpc("driver_end_trip", { p_trip_id: tripId });
    setBusy(false);
    if (error) {
      setLockMsg(error.message);
      return;
    }
    await reloadTrip();
    await refreshProfile();
  }

  if (!trip) return <Spinner />;
  const isAr = i18n.language === "ar";
  const confirmed = bookings.filter((b) => b.status === "confirmed");
  const waiting = bookings.filter((b) => b.is_waiting && b.status === "pending");

  return (
    <div className="page max-w-3xl">
      <Link
        to="/driver"
        className="inline-flex items-center gap-2 -ml-1 px-2 py-2 text-base sm:text-lg font-semibold text-brand-700 hover:underline"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M11 18l-6-6 6-6"/></svg>
        {t("nav.dashboard")}
      </Link>

      <div className="card p-5 mt-3 mb-5">
        <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
          <span className="chip">{relativeDateLabel(trip.depart_at)}</span>
          <StatusBadge status={trip.status} kind="trip" />
        </div>
        <h1 className="h2">
          {(isAr ? trip.from_name_ar : trip.from_name_fr)} →{" "}
          {(isAr ? trip.to_name_ar : trip.to_name_fr)}
        </h1>
        <div className="muted">
          {formatPeriod(trip.depart_at)} · {formatPrice(trip.price_per_seat)}
        </div>

        {/* Ajuster les places disponibles (voyage non terminé/annulé) */}
        {(trip.status === "scheduled" || trip.status === "in_progress") && (
          <div className="mt-4 rounded-2xl bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-ink">
                  {t("driver.seatsAvailableLabel")}
                </div>
                <div className="text-xs text-slate-500">
                  {t("driver.seatsAdjustHint")}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => adjustSeats(-1)}
                  disabled={busy || trip.seats_available <= 0}
                  className="w-10 h-10 rounded-xl border border-slate-200 bg-white text-2xl font-bold text-ink-soft active:scale-95 transition disabled:opacity-40"
                  aria-label="−"
                >
                  −
                </button>
                <span className="min-w-[3rem] text-center">
                  <span className="text-2xl font-extrabold text-brand-700">
                    {trip.seats_available}
                  </span>
                  <span className="text-sm text-slate-400">/{trip.seats_total}</span>
                </span>
                <button
                  type="button"
                  onClick={() => adjustSeats(1)}
                  disabled={busy || trip.seats_available >= trip.seats_total}
                  className="w-10 h-10 rounded-xl border border-slate-200 bg-white text-2xl font-bold text-ink-soft active:scale-95 transition disabled:opacity-40"
                  aria-label="+"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        )}

        {isInProgress && (
          <p className="text-xs text-brand-700 bg-brand-50 px-3 py-2 rounded-lg mt-3">
            📍 GPS actif — déblocage automatique à l&apos;arrivée (500 m)
          </p>
        )}

        {lockMsg && (
          <p className="text-sm text-rose-700 bg-rose-50 px-3 py-2 rounded-lg mt-3">{lockMsg}</p>
        )}

        <div className="mt-4 flex gap-2 flex-wrap">
          {trip.status === "scheduled" && (
            <>
              <button onClick={startTrip} disabled={busy} className="btn-primary">
                ▶ {t("driver.startTrip")}
              </button>
              <button onClick={cancelTrip} disabled={busy} className="btn-ghost text-rose-700 text-sm">
                {t("common.cancel")} voyage
              </button>
            </>
          )}
          {trip.status === "in_progress" &&
            (canEndTrip ? (
              <div className="w-full">
                <button onClick={endTrip} disabled={busy} className="btn-secondary">
                  ■ {t("driver.endTrip")}
                </button>
                {isAdmin && !nearDestination && (
                  <p className="text-xs text-slate-500 mt-2">
                    {t("driver.endTripAdminOverride")}
                  </p>
                )}
              </div>
            ) : (
              <div className="w-full rounded-2xl bg-amber-50 border border-amber-100 px-4 py-3 text-sm text-amber-800">
                <div className="font-semibold">{t("driver.endTripTooFarTitle")}</div>
                <p className="mt-0.5">
                  {distanceToDestM !== null
                    ? t("driver.endTripTooFar", {
                        distance: formatDistance(distanceToDestM),
                      })
                    : t("driver.endTripWaitingGps")}
                </p>
              </div>
            ))}
        </div>
      </div>

      {/* Carte de suivi */}
      {(trip.status === "scheduled" || trip.status === "in_progress") &&
        Number.isFinite(trip.from_lat) &&
        Number.isFinite(trip.to_lat) && (
          <div className="mb-4">
            <h2 className="font-bold text-ink mb-2">{t("trip.trackingMap")}</h2>
            <TrackingMap
              from={{ lat: trip.from_lat, lng: trip.from_lng, label: isAr ? trip.from_name_ar : trip.from_name_fr }}
              to={{ lat: trip.to_lat, lng: trip.to_lng, label: isAr ? trip.to_name_ar : trip.to_name_fr }}
              driver={driverPos}
              pickups={confirmed
                .filter((b) => b.pickup_lat != null && b.pickup_lng != null)
                .map((b) => ({
                  lat: b.pickup_lat as number,
                  lng: b.pickup_lng as number,
                  label: b.pickup_quartier ?? b.guest_name ?? "",
                }))}
            />
          </div>
        )}

      {/* Voyageurs confirmés */}
      {confirmed.length > 0 && (
        <div className="card p-4 mb-4">
          <h2 className="font-bold text-ink mb-2">
            {t("driver.confirmedPassengers")} ({confirmed.length})
          </h2>
          <div className="space-y-2">
            {confirmed.map((b) => {
              const profile = b.passenger_id ? profiles[b.passenger_id] : null;
              const name = b.guest_name ?? profile?.full_name ?? "—";
              const phone = b.guest_phone ?? profile?.phone ?? null;
              return (
                <div key={b.id} className="flex items-center justify-between text-sm bg-emerald-50 rounded-xl px-3 py-2">
                  <div>
                    <span className="font-semibold">{name}</span>
                    <span className="text-slate-500 ml-2">{b.seats} pl.</span>
                    {b.pickup_quartier && (
                      <span className="block text-xs text-slate-500">📍 {b.pickup_quartier}</span>
                    )}
                  </div>
                  {phone && (
                    <a href={`tel:${phone}`} className="text-brand-700 font-semibold">📞</a>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <h2 className="h2 mb-3">{t("driver.bookings")}</h2>
      {loading ? (
        <Spinner />
      ) : bookings.length === 0 ? (
        <div className="card p-8 text-center text-slate-500">
          {t("common.noResults")}
        </div>
      ) : (
        <div className="space-y-2">
          {bookings.map((b) => {
            const profile = b.passenger_id ? profiles[b.passenger_id] : null;
            const name = b.guest_name ?? profile?.full_name ?? "—";
            const phone = b.guest_phone ?? profile?.phone ?? null;
            return (
              <div key={b.id} className="card p-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-900">{name}</span>
                      <StatusBadge status={b.status} />
                      {b.is_waiting && (
                        <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                          {t("booking.waitingList")}
                        </span>
                      )}
                    </div>
                    <div className="muted">
                      {b.seats} {t("common.seats").toLowerCase()} · code{" "}
                      <span className="code-display font-bold text-brand-700">
                        {b.confirmation_code}
                      </span>
                    </div>
                    {b.pickup_quartier && (
                      <div className="text-xs text-slate-500 mt-1">
                        📍 {t("booking.pickupQuartier")} : {b.pickup_quartier}
                      </div>
                    )}
                  </div>
                  {phone && (
                    <a href={`tel:${phone}`} className="btn-secondary text-sm" title={t("driver.callPassenger")}>
                      📞 {phone}
                    </a>
                  )}
                </div>

                {b.status === "pending" && !b.is_waiting && (
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => setStatus(b, "confirmed")} className="btn-primary text-sm flex-1">
                      ✓ {t("common.confirm")}
                    </button>
                    <button onClick={() => setStatus(b, "rejected")} className="btn-ghost text-rose-700 text-sm flex-1">
                      ✕ {t("common.refuse")}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {waiting.length > 0 && (
        <div className="mt-4 card p-4 bg-amber-50 border-amber-100">
          <h3 className="font-bold text-amber-900 mb-2">{t("booking.waitingList")} ({waiting.length})</h3>
          {waiting.map((b) => (
            <div key={b.id} className="text-sm text-amber-800">
              {b.confirmation_code} — {b.seats} pl.
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Affiche une distance lisible : "350 m" ou "2.3 km". */
function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}
