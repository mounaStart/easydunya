import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../hooks/useAuth";
import {
  findBookingByCode,
  getRememberedCodes,
  useMyBookings,
} from "../../hooks/useBookings";
import { supabase } from "../../lib/supabase";
import type { Booking, TripPublic } from "../../lib/types";
import Spinner from "../../components/Spinner";
import StatusBadge from "../../components/StatusBadge";
import TrackingMap from "../../components/TrackingMap";
import { formatPrice, formatTime, relativeDateLabel } from "../../lib/utils";

const ACTIVE = ["pending", "confirmed"];

export default function Reservation() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const { user } = useAuth();
  const { bookings, loading } = useMyBookings(user?.id);

  const [trip, setTrip] = useState<TripPublic | null>(null);
  const [driverPhone, setDriverPhone] = useState<string | null>(null);
  const [byCode, setByCode] = useState<Booking | null>(null);
  const [codeChecked, setCodeChecked] = useState(false);

  // Réservation active liée au compte
  const fromAccount: Booking | undefined = useMemo(
    () => bookings.find((b) => ACTIVE.includes(b.status)),
    [bookings]
  );

  // Repli : réservations mémorisées sur cet appareil (code), utile en invité
  useEffect(() => {
    if (fromAccount) {
      setByCode(null);
      setCodeChecked(true);
      return;
    }
    let cancelled = false;
    setCodeChecked(false);
    (async () => {
      const codes = getRememberedCodes();
      for (const code of codes) {
        const b = await findBookingByCode(code);
        if (b && ACTIVE.includes(b.status)) {
          if (!cancelled) {
            setByCode(b);
            setCodeChecked(true);
          }
          return;
        }
      }
      if (!cancelled) {
        setByCode(null);
        setCodeChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fromAccount, bookings]);

  const active: Booking | undefined = fromAccount ?? byCode ?? undefined;
  const busy = (user ? loading : false) || (!active && !codeChecked);

  useEffect(() => {
    if (!active) {
      setTrip(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("trips_public")
        .select("*")
        .eq("id", active.trip_id)
        .maybeSingle();
      if (cancelled) return;
      const tp = (data as TripPublic | null) ?? null;
      setTrip(tp);
      if (tp?.driver_id) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("phone")
          .eq("id", tp.driver_id)
          .maybeSingle();
        if (!cancelled) setDriverPhone((prof as { phone?: string } | null)?.phone ?? null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [active]);

  if (busy) return <Spinner />;

  if (!active) {
    return (
      <div className="page max-w-md">
        <h1 className="h1 mb-4">{t("reservation.title")}</h1>
        <div className="card p-8 text-center space-y-4">
          <div className="text-5xl">🎫</div>
          <p className="text-slate-500">{t("reservation.none")}</p>
          <Link to="/" className="btn-primary w-full">
            {t("reservation.browse")}
          </Link>
          {!user && (
            <Link to="/login" className="btn-ghost w-full">
              {t("auth.signIn")}
            </Link>
          )}
        </div>
      </div>
    );
  }

  const fromName = trip ? (isAr ? trip.from_name_ar : trip.from_name_fr) : "";
  const toName = trip ? (isAr ? trip.to_name_ar : trip.to_name_fr) : "";
  const accepted = active.status === "confirmed";
  const started = trip?.status === "in_progress";

  return (
    <div className="page max-w-2xl space-y-4">
      <h1 className="h1">{t("reservation.title")}</h1>

      {/* Récapitulatif */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">
            {t("reservation.recapTitle")}
          </h2>
          <StatusBadge status={active.status} />
        </div>

        {trip && (
          <div className="text-xl font-extrabold text-ink flex items-center gap-2">
            {fromName}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-slate-400"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
            {toName}
          </div>
        )}

        <table className="w-full mt-4 text-sm">
          <tbody>
            {trip && (
              <Tr label={t("common.date")}>
                {relativeDateLabel(trip.depart_at)} · {formatTime(trip.depart_at)}
              </Tr>
            )}
            <Tr label={t("reservation.colSeats")}>{active.seats}</Tr>
            {trip && (
              <Tr label={t("common.price")}>
                {formatPrice(trip.price_per_seat * active.seats)}
              </Tr>
            )}
            <Tr label={t("reservation.colCode")}>
              <span className="code-display font-bold text-brand-700">
                {active.confirmation_code}
              </span>
            </Tr>
          </tbody>
        </table>
      </div>

      {/* Chauffeur : tableau récap si accepté, sinon état de la demande */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">
          {accepted ? t("reservation.driverTitle") : t("reservation.requestState")}
        </h2>

        {accepted && trip ? (
          <>
            <span className="badge-confirmed mb-3 inline-block">
              {t("reservation.acceptedBadge")}
            </span>
            <div className="overflow-hidden rounded-2xl border border-slate-100">
              <table className="w-full text-sm">
                <tbody>
                  <RowKV label={t("reservation.colDriver")}>
                    <div className="flex items-center gap-2">
                      <span
                        className="w-7 h-7 rounded-full inline-flex items-center justify-center text-white text-xs font-bold"
                        style={{ backgroundImage: "linear-gradient(135deg,#1e88d6,#f97316)" }}
                      >
                        {(trip.driver_name ?? "?").charAt(0)}
                      </span>
                      {trip.driver_name ?? "—"}
                    </div>
                  </RowKV>
                  <RowKV label={t("reservation.colPhone")}>
                    {driverPhone ? (
                      <a href={`tel:${driverPhone}`} className="text-brand-700 font-semibold">
                        {driverPhone}
                      </a>
                    ) : (
                      "—"
                    )}
                  </RowKV>
                  <RowKV label={t("reservation.colVehicle")}>
                    {trip.vehicle_label
                      ? `${trip.vehicle_label}${trip.vehicle_plate ? ` · ${trip.vehicle_plate}` : ""}`
                      : "—"}
                  </RowKV>
                  <RowKV label={t("reservation.colRating")}>
                    {trip.driver_rating
                      ? `★ ${Number(trip.driver_rating).toFixed(1)} (${trip.driver_rating_count})`
                      : t("trip.newDriver")}
                  </RowKV>
                </tbody>
              </table>
            </div>
            {driverPhone && (
              <a href={`tel:${driverPhone}`} className="btn-success w-full mt-3">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                {t("trip.call")}
              </a>
            )}
          </>
        ) : (
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex items-start gap-3">
            <span className="text-2xl">⏳</span>
            <div>
              <div className="font-semibold text-amber-800">
                {t("reservation.waitingDriver")}
              </div>
              <p className="text-sm text-amber-700 mt-0.5">
                {t("reservation.waitingDriverDesc")}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Suivi en direct */}
      {trip && (
        <div className="card overflow-hidden">
          <h2 className="flex items-center gap-2 text-lg font-bold text-ink px-5 pt-5">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1e88d6" strokeWidth="2"><path d="M4.9 19.1A10 10 0 0 1 4.9 5M19.1 5a10 10 0 0 1 0 14M8 16a5 5 0 0 1 0-8M16 8a5 5 0 0 1 0 8"/><circle cx="12" cy="12" r="1.5" fill="#1e88d6"/></svg>
            {t("trip.liveTracking")}
          </h2>
          {!started && (
            <div className="mx-5 mt-3 bg-amber-50 text-amber-700 rounded-2xl px-4 py-3 text-sm flex items-center gap-2">
              <span>⏳</span>
              {t("trip.notStarted")}
            </div>
          )}
          <div className="p-5 pt-3">
            <TrackingMap
              from={[trip.from_lat, trip.from_lng]}
              to={[trip.to_lat, trip.to_lng]}
            />
            <p className="muted text-center mt-3">{t("trip.waitingGps")}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function Tr({ label, children }: { label: string; children: ReactNode }) {
  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="py-2.5 text-slate-500">{label}</td>
      <td className="py-2.5 text-right font-semibold text-ink">{children}</td>
    </tr>
  );
}

function RowKV({ label, children }: { label: string; children: ReactNode }) {
  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="py-3 px-4 text-slate-500 bg-slate-50 w-1/3">{label}</td>
      <td className="py-3 px-4 font-semibold text-ink">{children}</td>
    </tr>
  );
}
