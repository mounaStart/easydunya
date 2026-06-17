import { useEffect, useMemo, useState } from "react";
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
import { clusterBookingsByQuartier } from "../../lib/mapClusters";
import { enrichBookingPickup } from "../../lib/passengerLocation";
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
  const [tripLoading, setTripLoading] = useState(true);
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

  const confirmed = useMemo(
    () => bookings.filter((b) => b.status === "confirmed"),
    [bookings]
  );
  const pending = useMemo(
    () => bookings.filter((b) => b.status === "pending" && !b.is_waiting),
    [bookings]
  );
  const otherBookings = useMemo(
    () => bookings.filter((b) => !(b.status === "pending" && !b.is_waiting)),
    [bookings]
  );
  const waiting = useMemo(
    () => bookings.filter((b) => b.is_waiting && b.status === "pending"),
    [bookings]
  );

  const mapPickups = useMemo(() => {
    const nameOf = (b: Booking) => {
      const profile = b.passenger_id ? profiles[b.passenger_id] : null;
      return b.guest_name ?? profile?.full_name ?? "—";
    };
    const enrichedPending = pending.map((b) => ({
      ...b,
      ...enrichBookingPickup(b, b.passenger_id ? profiles[b.passenger_id] : null),
    }));
    const enrichedConfirmed = confirmed.map((b) => ({
      ...b,
      ...enrichBookingPickup(b, b.passenger_id ? profiles[b.passenger_id] : null),
    }));
    return clusterBookingsByQuartier([...enrichedPending, ...enrichedConfirmed], nameOf).map((m) => ({
      id: m.id,
      lat: m.lat,
      lng: m.lng,
      quartier: m.quartier,
      count: m.count,
      passengerNames: m.passengerNames,
    }));
  }, [pending, confirmed, profiles]);

  const showMap =
    !!trip &&
    (trip.status === "scheduled" || trip.status === "in_progress") &&
    Number.isFinite(trip.from_lat) &&
    Number.isFinite(trip.to_lat);

  useEffect(() => {
    if (!tripId) {
      setTripLoading(false);
      return;
    }
    setTripLoading(true);
    supabase
      .from("trips_public")
      .select("*")
      .eq("id", tripId)
      .maybeSingle()
      .then(({ data }) => {
        setTrip((data as TripPublic | null) ?? null);
        setTripLoading(false);
      });
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

  if (tripLoading || loading) return <Spinner />;
  if (!trip) {
    return (
      <div className="page max-w-3xl py-8 text-center">
        <p className="text-slate-500">{t("common.noResults")}</p>
        <Link to="/driver" className="btn-primary mt-4 inline-flex">
          {t("nav.dashboard")}
        </Link>
      </div>
    );
  }

  const isAr = i18n.language === "ar";

  function renderBookingCard(b: Booking) {
    const profile = b.passenger_id ? profiles[b.passenger_id] : null;
    const name = b.guest_name ?? profile?.full_name ?? "—";
    const phone = b.guest_phone ?? profile?.phone ?? null;
    return (
      <div key={b.id} className="card p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-sm text-slate-900">{name}</span>
              <StatusBadge status={b.status} />
              {b.is_waiting && (
                <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full">
                  {t("booking.waitingList")}
                </span>
              )}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              {b.seats} {t("common.seats").toLowerCase()} ·{" "}
              <span className="code-display font-bold text-brand-700">
                {b.confirmation_code}
              </span>
            </div>
            {b.pickup_quartier && (
              <div className="text-[11px] text-slate-500 mt-0.5">
                📍 {b.pickup_quartier}
              </div>
            )}
          </div>
          {phone && (
            <a
              href={`tel:${phone}`}
              className="btn-secondary text-xs py-1.5 px-2.5 shrink-0"
              title={t("driver.callPassenger")}
            >
              📞
            </a>
          )}
        </div>

        {b.status === "pending" && !b.is_waiting && (
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => setStatus(b, "confirmed")}
              className="btn-primary text-xs py-2 px-3 flex-1"
            >
              ✓ {t("common.confirm")}
            </button>
            <button
              onClick={() => setStatus(b, "rejected")}
              className="btn-ghost text-rose-700 text-xs py-2 px-3 flex-1"
            >
              ✕ {t("common.refuse")}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="page max-w-3xl py-4">
      <Link
        to="/driver"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M11 18l-6-6 6-6"/></svg>
        {t("nav.dashboard")}
      </Link>

      <div className="card p-3 sm:p-4 mt-2 mb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <StatusBadge status={trip.status} kind="trip" />
              <span className="chip text-xs py-0.5 px-2">{relativeDateLabel(trip.depart_at)}</span>
            </div>
            <h1 className="text-lg font-bold text-ink leading-tight mt-1">
              {(isAr ? trip.from_name_ar : trip.from_name_fr)} →{" "}
              {(isAr ? trip.to_name_ar : trip.to_name_fr)}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {formatPeriod(trip.depart_at)} · {formatPrice(trip.price_per_seat)}
            </p>
          </div>

          {(trip.status === "scheduled" || trip.status === "in_progress") && (
            <div className="shrink-0 text-center">
              <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                {t("driver.seatsAvailableLabel")}
              </div>
              <div className="inline-flex items-center gap-1 rounded-xl bg-slate-50 border border-slate-100 px-1 py-0.5">
                <button
                  type="button"
                  onClick={() => adjustSeats(-1)}
                  disabled={busy || trip.seats_available <= 0}
                  className="w-8 h-8 rounded-lg bg-white text-lg font-bold text-ink-soft active:scale-95 transition disabled:opacity-40"
                  aria-label="−"
                >
                  −
                </button>
                <span className="min-w-[2.5rem] text-center text-sm font-extrabold text-brand-700">
                  {trip.seats_available}
                  <span className="text-xs font-normal text-slate-400">/{trip.seats_total}</span>
                </span>
                <button
                  type="button"
                  onClick={() => adjustSeats(1)}
                  disabled={busy || trip.seats_available >= trip.seats_total}
                  className="w-8 h-8 rounded-lg bg-white text-lg font-bold text-ink-soft active:scale-95 transition disabled:opacity-40"
                  aria-label="+"
                >
                  +
                </button>
              </div>
            </div>
          )}
        </div>

        {isInProgress && (
          <p className="text-[11px] text-brand-700 bg-brand-50 px-2 py-1 rounded-lg mt-2">
            📍 GPS actif — déblocage à l&apos;arrivée (500 m)
          </p>
        )}

        {lockMsg && (
          <p className="text-xs text-rose-700 bg-rose-50 px-2 py-1.5 rounded-lg mt-2">{lockMsg}</p>
        )}

        <div className="mt-2.5 flex gap-2 items-center flex-wrap">
          {trip.status === "scheduled" && (
            <>
              <button onClick={startTrip} disabled={busy} className="btn-primary text-sm py-2 px-4 flex-1 min-w-0">
                ▶ {t("driver.startTrip")}
              </button>
              <button onClick={cancelTrip} disabled={busy} className="btn-ghost text-rose-700 text-xs py-2 shrink-0">
                {t("common.cancel")}
              </button>
            </>
          )}
          {trip.status === "in_progress" &&
            (canEndTrip ? (
              <div className="w-full">
                <button onClick={endTrip} disabled={busy} className="btn-secondary text-sm py-2 w-full">
                  ■ {t("driver.endTrip")}
                </button>
                {isAdmin && !nearDestination && (
                  <p className="text-[11px] text-slate-500 mt-1">
                    {t("driver.endTripAdminOverride")}
                  </p>
                )}
              </div>
            ) : (
              <div className="w-full rounded-xl bg-amber-50 border border-amber-100 px-3 py-2 text-xs text-amber-800">
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

      {/* Demandes en attente — avant la carte */}
      {loading ? (
        <div className="mb-3">
          <Spinner />
        </div>
      ) : pending.length > 0 ? (
        <div className="mb-3">
          <h2 className="text-base font-bold text-ink mb-2">
            {t("driver.pendingTotal")} ({pending.length})
          </h2>
          <div className="space-y-2">{pending.map(renderBookingCard)}</div>
        </div>
      ) : null}

      {/* Carte de suivi */}
      {showMap && (
        <div className="mb-3">
          <h2 className="text-sm font-bold text-ink mb-1.5">{t("trip.trackingMap")}</h2>
          <TrackingMap
            from={{ lat: trip.from_lat, lng: trip.from_lng, label: isAr ? trip.from_name_ar : trip.from_name_fr }}
            to={{ lat: trip.to_lat, lng: trip.to_lng, label: isAr ? trip.to_name_ar : trip.to_name_fr }}
            driver={driverPos}
            pickups={mapPickups}
          />
        </div>
      )}

      {/* Autres réservations — sous la carte */}
      {!loading && otherBookings.length > 0 && (
        <div>
          <h2 className="text-base font-bold text-ink mb-2">{t("driver.bookings")}</h2>
          <div className="space-y-2">{otherBookings.map(renderBookingCard)}</div>
        </div>
      )}

      {!loading && bookings.length === 0 && (
        <div className="card p-6 text-center text-slate-500 text-sm">
          {t("common.noResults")}
        </div>
      )}

      {waiting.length > 0 && (
        <div className="mt-3 card p-3 bg-amber-50 border-amber-100">
          <h3 className="text-sm font-bold text-amber-900 mb-1.5">
            {t("booking.waitingList")} ({waiting.length})
          </h3>
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
