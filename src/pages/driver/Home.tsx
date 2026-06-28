import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../hooks/useAuth";
import { updateBookingStatus } from "../../hooks/useBookings";
import { useDriverGps, useTripDriverPosition } from "../../hooks/useDriverGps";
import { supabase } from "../../lib/supabase";
import type { Booking, Payment, Profile, TripPublic } from "../../lib/types";
import Spinner from "../../components/Spinner";
import TrackingMap from "../../components/TrackingMap";
import { clusterBookingsByQuartier } from "../../lib/mapClusters";
import { driverPassengerPhone } from "../../lib/driverBookingPrivacy";
import { enrichBookingPickup } from "../../lib/passengerLocation";
import { cn, formatPrice, formatPeriod, relativeDateLabel } from "../../lib/utils";

function withEnrichedPickup(
  bookings: Booking[],
  profiles: Record<string, Profile>
): Booking[] {
  return bookings.map((b) => {
    const profile = b.passenger_id ? profiles[b.passenger_id] : null;
    return { ...b, ...enrichBookingPickup(b, profile) };
  });
}

function isToday(iso: string | null): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const n = new Date();
  return (
    d.getFullYear() === n.getFullYear() &&
    d.getMonth() === n.getMonth() &&
    d.getDate() === n.getDate()
  );
}

export default function DriverHome() {
  const { t, i18n } = useTranslation();
  const { user, profile } = useAuth();
  const isAr = i18n.language === "ar";

  const [trips, setTrips] = useState<TripPublic[]>([]);
  const [pendingByTrip, setPendingByTrip] = useState<Record<string, number>>({});
  const [focusTripId, setFocusTripId] = useState<string | null>(null);
  const [focusBookings, setFocusBookings] = useState<Booking[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [pendingCount, setPendingCount] = useState(0);
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);
  const [selectedOffMapBookingId, setSelectedOffMapBookingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [todayEarnings, setTodayEarnings] = useState(0);
  const [loading, setLoading] = useState(true);

  const activeTrips = useMemo(
    () => trips.filter((tr) => tr.status === "scheduled" || tr.status === "in_progress"),
    [trips]
  );

  const tripsWithPending = useMemo(
    () =>
      activeTrips
        .filter((tr) => (pendingByTrip[tr.id] ?? 0) > 0)
        .sort((a, b) => {
          const pendingDiff = (pendingByTrip[b.id] ?? 0) - (pendingByTrip[a.id] ?? 0);
          if (pendingDiff !== 0) return pendingDiff;
          return new Date(a.depart_at).getTime() - new Date(b.depart_at).getTime();
        }),
    [activeTrips, pendingByTrip]
  );

  const activeTrip = activeTrips.find((tr) => tr.status === "in_progress") ?? null;
  const nextTrip =
    activeTrips
      .filter((tr) => tr.status === "scheduled")
      .sort((a, b) => new Date(a.depart_at).getTime() - new Date(b.depart_at).getTime())[0] ??
    null;
  const focusTrip = activeTrips.find((tr) => tr.id === focusTripId) ?? null;

  const isInProgress = focusTrip?.status === "in_progress";
  useDriverGps(focusTrip?.id, isInProgress);
  const driverPos = useTripDriverPosition(focusTrip?.id, isInProgress);

  useEffect(() => {
    if (!activeTrips.length) {
      setFocusTripId(null);
      return;
    }
    setFocusTripId((prev) => {
      if (prev && activeTrips.some((tr) => tr.id === prev)) return prev;
      if (activeTrip) return activeTrip.id;
      if (tripsWithPending[0]) return tripsWithPending[0].id;
      return [...activeTrips].sort(
        (a, b) => new Date(a.depart_at).getTime() - new Date(b.depart_at).getTime()
      )[0].id;
    });
  }, [activeTrips, tripsWithPending, activeTrip]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function load() {
      if (!user) return;

      const { data: tripsData } = await supabase
        .from("trips_public")
        .select("*")
        .eq("driver_id", user.id)
        .order("depart_at", { ascending: true });
      const allTrips = (tripsData as TripPublic[] | null) ?? [];

      const activeTripIds = allTrips
        .filter((tr) => tr.status === "scheduled" || tr.status === "in_progress")
        .map((tr) => tr.id);

      let pendingTotal = 0;
      const pendingMap: Record<string, number> = {};
      if (activeTripIds.length > 0) {
        const { data: pendingRows } = await supabase
          .from("bookings")
          .select("trip_id")
          .in("trip_id", activeTripIds)
          .eq("status", "pending")
          .eq("is_waiting", false);

        for (const row of pendingRows ?? []) {
          const tid = row.trip_id as string;
          pendingMap[tid] = (pendingMap[tid] ?? 0) + 1;
          pendingTotal++;
        }
      }

      const { data: payData } = await supabase
        .from("payments")
        .select("driver_earning, paid_at")
        .eq("driver_id", user.id)
        .eq("status", "paid");
      const today = (payData as Payment[] | null ?? []).reduce(
        (sum, p) => (isToday(p.paid_at) ? sum + p.driver_earning : sum),
        0
      );

      if (!cancelled) {
        setTrips(allTrips);
        setPendingByTrip(pendingMap);
        setPendingCount(pendingTotal);
        setTodayEarnings(today);
        setLoading(false);
      }
    }

    load();
    const channel = supabase
      .channel(`driver-home-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => {
        if (!cancelled) load();
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user]);

  useEffect(() => {
    if (!focusTripId) {
      setFocusBookings([]);
      setProfiles({});
      setSelectedClusterId(null);
      return;
    }

    let cancelled = false;
    async function loadBookings() {
      const { data } = await supabase
        .from("bookings")
        .select("*")
        .eq("trip_id", focusTripId)
        .in("status", ["pending", "confirmed"])
        .order("created_at", { ascending: false });

      const list = (data as Booking[] | null) ?? [];
      const passengerIds = list
        .map((b) => b.passenger_id)
        .filter((x): x is string => !!x);

      let profMap: Record<string, Profile> = {};
      if (passengerIds.length > 0) {
        const { data: profData } = await supabase
          .from("profiles")
          .select("*")
          .in("id", passengerIds);
        (profData as Profile[] | null)?.forEach((p) => (profMap[p.id] = p));
      }

      if (!cancelled) {
        setFocusBookings(list);
        setProfiles(profMap);
        setSelectedClusterId((prev) => {
          if (!prev) return null;
          const still = list.some((b) => {
            const q = b.pickup_quartier?.trim().toLowerCase();
            return q && q === prev && b.status === "pending" && !b.is_waiting;
          });
          return still ? prev : null;
        });
      }
    }

    loadBookings();
    const channel = supabase
      .channel(`driver-home-trip-${focusTripId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => {
        if (!cancelled) loadBookings();
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [focusTripId]);

  async function handleBookingStatus(booking: Booking, status: Booking["status"]) {
    setBusyId(booking.id);
    const { error } = await updateBookingStatus(booking.id, status);
    setBusyId(null);
    if (!error) {
      if (status === "rejected" || status === "confirmed") {
        setPendingByTrip((prev) => ({
          ...prev,
          [booking.trip_id]: Math.max(0, (prev[booking.trip_id] ?? 0) - 1),
        }));
        setPendingCount((c) => Math.max(0, c - 1));
      }
      if (status === "rejected") {
        setFocusBookings((prev) => prev.filter((b) => b.id !== booking.id));
      } else {
        setFocusBookings((prev) =>
          prev.map((b) => (b.id === booking.id ? { ...b, status } : b))
        );
      }
      if (status !== "pending") setSelectedClusterId(null);
    }
  }

  function bookingName(b: Booking) {
    const p = b.passenger_id ? profiles[b.passenger_id] : null;
    const name = b.guest_name?.trim() || p?.full_name?.trim();
    if (name) return name;
    const phone = driverPassengerPhone(b, p);
    if (phone) return phone;
    return t("driver.unknownPassenger");
  }

  function bookingPhone(b: Booking) {
    const p = b.passenger_id ? profiles[b.passenger_id] : null;
    return driverPassengerPhone(b, p);
  }

  const route = (tr: TripPublic) =>
    `${isAr ? tr.from_name_ar : tr.from_name_fr} → ${isAr ? tr.to_name_ar : tr.to_name_fr}`;

  const pendingOnFocus = useMemo(
    () =>
      withEnrichedPickup(
        focusBookings.filter((b) => b.status === "pending" && !b.is_waiting),
        profiles
      ),
    [focusBookings, profiles]
  );

  const quartierMarkers = useMemo(
    () => clusterBookingsByQuartier(pendingOnFocus, bookingName),
    [pendingOnFocus, profiles, i18n.language]
  );

  const mapPickups = useMemo(() => {
    if (!focusTrip) return [];
    const cityLabels = new Set(
      [
        focusTrip.from_name_fr,
        focusTrip.to_name_fr,
        focusTrip.from_name_ar,
        focusTrip.to_name_ar,
        "Nouakchott",
        "Kaédi",
      ]
        .filter(Boolean)
        .map((s) => s!.trim().toLowerCase())
    );
    return quartierMarkers
      .filter((m) => m.quartier && !cityLabels.has(m.quartier.trim().toLowerCase()))
      .map((m) => ({
        id: m.id,
        lat: m.lat,
        lng: m.lng,
        quartier: m.quartier,
        count: m.count,
        passengerNames: m.passengerNames,
      }));
  }, [quartierMarkers, focusTrip]);

  const selectedCluster = quartierMarkers.find((c) => c.id === selectedClusterId) ?? null;
  const selectedClusterBookings = pendingOnFocus.filter((b) =>
    selectedCluster?.bookingIds.includes(b.id)
  );

  const selectedOffMapBooking =
    focusBookings.find((b) => b.id === selectedOffMapBookingId) ?? null;

  const bookingsWithoutMap = pendingOnFocus.filter(
    (b) => !b.pickup_quartier?.trim() || b.pickup_lat == null || b.pickup_lng == null
  );

  const hasMapCoords = (tr: TripPublic) =>
    Number.isFinite(tr.from_lat) &&
    Number.isFinite(tr.from_lng) &&
    Number.isFinite(tr.to_lat) &&
    Number.isFinite(tr.to_lng);

  const showMap = focusTrip != null && hasMapCoords(focusTrip);

  if (loading) return <Spinner />;

  if (profile?.role === "driver" && profile.driver_status !== "approved") {
    return <DriverStatusNotice status={profile.driver_status} />;
  }

  const firstName = (profile?.full_name ?? "").split(/\s+/)[0] ?? "";

  return (
    <div className="page max-w-2xl space-y-5">
      <div>
        <h1 className="h1">
          {t("driver.greeting")}{firstName ? `, ${firstName}` : ""} 👋
        </h1>
        <p className="muted">{t("driver.greetingSub")}</p>
      </div>

      {activeTrip ? (
        <Link
          to={`/driver/trips/${activeTrip.id}/bookings`}
          className="card p-5 flex items-center gap-4 bg-brand-50 border-brand-200 hover:shadow-md transition"
        >
          <span className="w-14 h-14 rounded-2xl bg-brand-600 text-white flex items-center justify-center text-2xl shrink-0">
            🚗
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-bold text-brand-800">{t("driver.activeTripTitle")}</div>
            <div className="text-sm text-brand-700 truncate">{route(activeTrip)}</div>
            <div className="text-xs text-brand-600 mt-0.5">{t("driver.activeTripDesc")}</div>
          </div>
          <span className="btn-primary text-sm shrink-0">{t("driver.manageTrip")}</span>
        </Link>
      ) : (
        <Link
          to="/driver/trips/new"
          className="card p-5 flex items-center gap-4 hover:shadow-md transition"
          style={{ backgroundImage: "linear-gradient(135deg,#1e88d6,#0f6fb8)" }}
        >
          <span className="w-14 h-14 rounded-2xl bg-white/20 text-white flex items-center justify-center text-3xl shrink-0">
            +
          </span>
          <div className="min-w-0 flex-1 text-white">
            <div className="font-bold text-lg">{t("driver.publishCtaTitle")}</div>
            <div className="text-sm text-white/85">{t("driver.publishCtaDesc")}</div>
          </div>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 rtl:rotate-180"><path d="M9 6l6 6-6 6"/></svg>
        </Link>
      )}

      <div className="grid grid-cols-3 gap-3">
        <MiniTile icon="💰" label={t("driver.todayEarnings")} value={formatPrice(todayEarnings)} tone="emerald" />
        <MiniTile
          icon="🕒"
          label={t("driver.nextDeparture")}
          value={nextTrip ? formatPeriod(nextTrip.depart_at) : "—"}
          tone="brand"
        />
        <MiniTile icon="🔔" label={t("driver.pendingTotal")} value={String(pendingCount)} tone="amber" />
      </div>

      {/* Carte maps + infos passager au clic */}
      <div>
        <h2 className="h2 mb-2">{t("trip.trackingMap")}</h2>

        {activeTrips.length === 0 ? (
          <div className="card p-5 text-center text-slate-500 text-sm">
            {t("driver.noMapTrip")}
          </div>
        ) : focusTrip ? (
          <div className="card overflow-hidden">
            {tripsWithPending.length > 0 && (
              <div className="px-3 pt-3 pb-1 flex gap-2 overflow-x-auto">
                {tripsWithPending.map((tr) => {
                  const pending = pendingByTrip[tr.id] ?? 0;
                  const selected = tr.id === focusTrip.id;
                  return (
                    <button
                      key={tr.id}
                      type="button"
                      onClick={() => {
                        setFocusTripId(tr.id);
                        setSelectedClusterId(null);
                        setSelectedOffMapBookingId(null);
                      }}
                      className={cn(
                        "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold border transition",
                        selected
                          ? "bg-brand-600 text-white border-brand-600"
                          : "bg-white text-slate-600 border-slate-200 hover:border-brand-300"
                      )}
                    >
                      {route(tr)} · {pending} {t("booking.status.pending").toLowerCase()}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="px-3 pt-2 pb-2 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="font-semibold text-ink truncate">{route(focusTrip)}</div>
                <div className="text-xs text-slate-500">
                  {relativeDateLabel(focusTrip.depart_at)} · {formatPeriod(focusTrip.depart_at)}
                  {(pendingByTrip[focusTrip.id] ?? 0) > 0 && (
                    <span className="ml-1.5 text-rose-600 font-semibold">
                      · {pendingByTrip[focusTrip.id]} {t("driver.pendingRequests")}
                    </span>
                  )}
                </div>
              </div>
              <Link
                to={`/driver/trips/${focusTrip.id}/bookings`}
                className="text-xs font-semibold text-brand-700 hover:underline shrink-0"
              >
                {t("driver.manageBookings")} →
              </Link>
            </div>

            {mapPickups.length > 0 ? (
              <TrackingMap
                variant="pickups"
                height={240}
                pickups={mapPickups}
                driver={driverPos}
                selectedPickupId={selectedClusterId}
                onPickupSelect={(id) => {
                  setSelectedClusterId(id);
                  setSelectedOffMapBookingId(null);
                }}
              />
            ) : pendingOnFocus.length > 0 ? (
              <p className="px-3 py-4 text-xs text-amber-700 bg-amber-50 border-y border-amber-100">
                {t("driver.noPickupOnMap")}
              </p>
            ) : !showMap ? (
              <p className="px-3 py-4 text-xs text-amber-700 bg-amber-50 border-y border-amber-100">
                {t("driver.mapCoordsMissing")}
              </p>
            ) : null}

            {bookingsWithoutMap.length > 0 && (
              <div className="px-3 py-2 border-t border-slate-100 space-y-1.5">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                  {t("driver.pendingTotal")}
                </p>
                {bookingsWithoutMap.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => {
                      setSelectedOffMapBookingId(b.id);
                      setSelectedClusterId(null);
                    }}
                    className={cn(
                      "w-full text-left rounded-xl px-3 py-2 text-sm border transition",
                      selectedOffMapBookingId === b.id
                        ? "border-brand-300 bg-brand-50"
                        : "border-slate-100 bg-slate-50 hover:border-slate-200"
                    )}
                  >
                    <span className="font-semibold text-ink">{bookingName(b)}</span>
                    {b.pickup_quartier && (
                      <span className="text-brand-700 ml-1">· {b.pickup_quartier}</span>
                    )}
                    <span className="text-slate-500 ml-1">
                      · {b.seats} {t("common.seats").toLowerCase()}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {showMap && (
              <p className="px-3 py-2 text-[11px] text-slate-500 border-t border-slate-100">
                {t("driver.tapMarkerHint")}
              </p>
            )}

            {selectedCluster && selectedClusterBookings.length > 0 && (
              <div className="px-3 pb-3 border-t border-slate-100 bg-slate-50/80">
                <div className="pt-3">
                  <p className="text-sm font-bold text-ink mb-2">
                    {selectedCluster.quartier} · {selectedCluster.count}{" "}
                    {selectedCluster.count > 1
                      ? t("driver.passengersInQuartier")
                      : t("driver.passengerInQuartier")}
                  </p>
                  <div className="space-y-3">
                    {selectedClusterBookings.map((b) => (
                      <div
                        key={b.id}
                        className="rounded-xl border border-slate-200 bg-white p-3 text-sm space-y-1.5"
                      >
                        <InfoRow label={t("driver.passengerName")} value={bookingName(b)} />
                        {bookingPhone(b) && (
                          <InfoRow
                            label={t("driver.passengerPhone")}
                            value={
                              <a href={`tel:${bookingPhone(b)}`} className="text-brand-700 font-semibold">
                                {bookingPhone(b)}
                              </a>
                            }
                          />
                        )}
                        <InfoRow label={t("common.seats")} value={String(b.seats)} />
                        <InfoRow
                          label={t("driver.confirmationCode")}
                          value={
                            <span className="code-display font-bold text-brand-700">
                              {b.confirmation_code}
                            </span>
                          }
                        />
                        <div className="flex gap-2 pt-1">
                          <button
                            type="button"
                            disabled={busyId === b.id}
                            onClick={() => handleBookingStatus(b, "confirmed")}
                            className="btn-primary text-xs py-2 px-3 flex-1"
                          >
                            ✓ {t("common.confirm")}
                          </button>
                          <button
                            type="button"
                            disabled={busyId === b.id}
                            onClick={() => handleBookingStatus(b, "rejected")}
                            className="btn-ghost text-rose-700 text-xs py-2 px-3 flex-1"
                          >
                            ✕ {t("common.refuse")}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {selectedOffMapBooking && (
              <div className="px-3 pb-3 border-t border-slate-100 bg-slate-50/80">
                <div className="pt-3 space-y-1.5 text-sm">
                  <InfoRow label={t("driver.passengerName")} value={bookingName(selectedOffMapBooking)} />
                  {bookingPhone(selectedOffMapBooking) && (
                    <InfoRow
                      label={t("driver.passengerPhone")}
                      value={
                        <a
                          href={`tel:${bookingPhone(selectedOffMapBooking)}`}
                          className="text-brand-700 font-semibold"
                        >
                          {bookingPhone(selectedOffMapBooking)}
                        </a>
                      }
                    />
                  )}
                  <InfoRow label={t("common.seats")} value={String(selectedOffMapBooking.seats)} />
                  <InfoRow
                    label={t("driver.confirmationCode")}
                    value={
                      <span className="code-display font-bold text-brand-700">
                        {selectedOffMapBooking.confirmation_code}
                      </span>
                    }
                  />
                  {selectedOffMapBooking.pickup_quartier && (
                    <InfoRow
                      label={t("booking.pickupQuartier")}
                      value={selectedOffMapBooking.pickup_quartier}
                    />
                  )}
                </div>
                <div className="mt-2.5 flex gap-2">
                  <button
                    type="button"
                    disabled={busyId === selectedOffMapBooking.id}
                    onClick={() => handleBookingStatus(selectedOffMapBooking, "confirmed")}
                    className="btn-primary text-xs py-2 px-3 flex-1"
                  >
                    ✓ {t("common.confirm")}
                  </button>
                  <button
                    type="button"
                    disabled={busyId === selectedOffMapBooking.id}
                    onClick={() => handleBookingStatus(selectedOffMapBooking, "rejected")}
                    className="btn-ghost text-rose-700 text-xs py-2 px-3 flex-1"
                  >
                    ✕ {t("common.refuse")}
                  </button>
                </div>
              </div>
            )}

            {showMap && mapPickups.length === 0 && pendingOnFocus.length > 0 && (
              <p className="px-3 pb-3 text-xs text-amber-700">
                {t("driver.noPickupOnMap")}
              </p>
            )}
          </div>
        ) : null}
      </div>

      <div>
        <h2 className="h2 mb-2">{t("driver.quickActions")}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <ShortcutTile to="/driver/trips/new" icon="➕" label={t("driver.newTripTitle")} />
          <ShortcutTile to="/driver/earnings" icon="💰" label={t("driver.earningsTitle")} />
          <ShortcutTile to="/driver/historique" icon="🕘" label={t("nav.historique")} />
          <ShortcutTile to="/driver/vehicles" icon="🚙" label={t("driver.myVehicles")} />
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-slate-500 shrink-0">{label}</span>
      <span className="font-medium text-ink text-right">{value}</span>
    </div>
  );
}

function MiniTile({
  icon,
  label,
  value,
  tone,
}: {
  icon: string;
  label: string;
  value: string;
  tone: "emerald" | "brand" | "amber";
}) {
  const toneClass =
    tone === "emerald" ? "text-emerald-600" : tone === "amber" ? "text-amber-600" : "text-brand-700";
  return (
    <div className="card p-3 text-center">
      <div className="text-lg">{icon}</div>
      <div className={`font-bold mt-0.5 leading-tight ${toneClass}`}>{value}</div>
      <div className="text-[11px] text-slate-500 mt-0.5">{label}</div>
    </div>
  );
}

function ShortcutTile({ to, icon, label }: { to: string; icon: string; label: string }) {
  return (
    <Link
      to={to}
      className="card p-4 flex flex-col items-center justify-center gap-1.5 text-center hover:shadow-md transition"
    >
      <span className="text-2xl">{icon}</span>
      <span className="text-xs font-semibold text-slate-700 leading-tight">{label}</span>
    </Link>
  );
}

function DriverStatusNotice({ status }: { status: string | null }) {
  const map: Record<string, { emoji: string; title: string; desc: string; bg: string }> = {
    pending: {
      emoji: "⏳",
      title: "Compte en attente de validation",
      desc: "Votre compte chauffeur est en cours de vérification par l'équipe Easy Dunya.",
      bg: "bg-amber-50 border-amber-200",
    },
    rejected: {
      emoji: "❌",
      title: "Compte refusé",
      desc: "Votre demande de compte chauffeur a été refusée. Contactez Easy Dunya.",
      bg: "bg-rose-50 border-rose-200",
    },
    suspended: {
      emoji: "⏸",
      title: "Compte suspendu",
      desc: "Votre compte chauffeur est temporairement suspendu. Contactez Easy Dunya.",
      bg: "bg-slate-100 border-slate-200",
    },
  };
  const info = map[status ?? "pending"] ?? map.pending;
  return (
    <div className="page max-w-xl">
      <div className={`card p-6 text-center ${info.bg}`}>
        <div className="text-4xl mb-2">{info.emoji}</div>
        <h1 className="h2 mb-2">{info.title}</h1>
        <p className="text-slate-600">{info.desc}</p>
      </div>
    </div>
  );
}
