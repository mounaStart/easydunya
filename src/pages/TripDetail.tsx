import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useTrip } from "../hooks/useTrips";
import { useAuth } from "../hooks/useAuth";
import { createBooking, rememberBookingCode } from "../hooks/useBookings";
import { resolveBookingPickup } from "../lib/passengerLocation";
import { useTripDriverPosition } from "../hooks/useDriverGps";
import type { Booking } from "../lib/types";
import Spinner from "../components/Spinner";
import TrackingMap from "../components/TrackingMap";
import {
  copyToClipboard,
  formatPrice,
  formatPeriod,
  relativeDateLabel,
  shareViaWhatsApp,
} from "../lib/utils";

function initials(name: string | null): string {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: JSX.Element;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-2.5 py-2">
      <span className="icon-tile-soft w-8 h-8 shrink-0 [&_svg]:w-4 [&_svg]:h-4">{icon}</span>
      <div className="min-w-0">
        <div className="text-[10px] text-slate-400 leading-none">{label}</div>
        <div className="font-bold text-sm text-ink truncate">{value}</div>
      </div>
    </div>
  );
}

export default function TripDetail() {
  const { tripId } = useParams();
  const { trip, loading } = useTrip(tripId);
  const { t, i18n } = useTranslation();
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [seats, setSeats] = useState(1);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const driverPos = useTripDriverPosition(tripId, trip?.status === "in_progress");

  if (loading) return <Spinner />;
  if (!trip) {
    return (
      <div className="page">
        <p className="card p-6 text-center text-slate-500">
          {t("common.noResults")}
        </p>
      </div>
    );
  }

  const isAr = i18n.language === "ar";
  const fromName = isAr ? trip.from_name_ar : trip.from_name_fr;
  const toName = isAr ? trip.to_name_ar : trip.to_name_fr;
  const noSeats = trip.seats_available <= 0;
  const maxSeats = Math.max(1, trip.seats_available);
  const subtotal = trip.price_per_seat * seats;

  const statusLabel = t(`trip.status.${trip.status}`);
  const statusClass =
    trip.status === "scheduled"
      ? "bg-emerald-100 text-emerald-700"
      : trip.status === "in_progress"
        ? "bg-brand-100 text-brand-700"
        : trip.status === "completed"
          ? "bg-sky-100 text-sky-700"
          : "bg-slate-200 text-slate-600";

  async function handleConfirm(waiting = false) {
    if (!trip || !user) return;
    setBusy(true);
    setError(null);

    const { pickupLat, pickupLng, pickupQuartier } = await resolveBookingPickup(
      user.id,
      profile
    );

    const { booking, error } = await createBooking({
      tripId: trip.id,
      seats,
      passengerId: user.id,
      guestName: profile?.full_name ?? undefined,
      guestPhone: profile?.phone ?? undefined,
      pickupLat,
      pickupLng,
      pickupQuartier,
      isWaiting: waiting,
    });
    setBusy(false);
    if (error || !booking) {
      setError(error ?? t("booking.createError"));
      return;
    }
    rememberBookingCode(booking.confirmation_code);
    setBooking(booking);
  }

  async function handleCopy() {
    if (!booking) return;
    const ok = await copyToClipboard(booking.confirmation_code);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  }

  function handleShare() {
    if (!booking || !trip) return;
    shareViaWhatsApp(
      [
        `Easy Dunya — ${t("booking.title")}`,
        `${fromName} → ${toName}`,
        `${relativeDateLabel(trip.depart_at)} · ${formatPeriod(trip.depart_at)}`,
        `${t("booking.yourCode")}: ${booking.confirmation_code}`,
      ].join("\n")
    );
  }

  return (
    <div className="page max-w-2xl space-y-3 py-3">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1.5 text-sm text-ink font-semibold"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M11 18l-6-6 6-6"/></svg>
        {t("common.back")}
      </button>

      {/* En-tête voyage + chauffeur */}
      <div className="card p-3.5 sm:p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-extrabold text-ink leading-tight">
              {fromName}
              <span className="mx-1.5 text-slate-400">→</span>
              {toName}
            </h1>
            <div className="text-xs text-slate-500 mt-0.5">
              {relativeDateLabel(trip.depart_at)}
            </div>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusClass}`}>
            {statusLabel}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-3">
          <InfoRow
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>}
            label={t("trip.departure")}
            value={formatPeriod(trip.depart_at)}
          />
          <InfoRow
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-3-3.87M2 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2"/><circle cx="9" cy="7" r="4"/></svg>}
            label={t("trip.places")}
            value={`${trip.seats_available}/${trip.seats_total}`}
          />
          <InfoRow
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>}
            label={t("common.price")}
            value={formatPrice(trip.price_per_seat)}
          />
        </div>

        {trip.notes && (
          <div className="mt-2.5 bg-slate-50 rounded-xl px-3 py-2 text-xs text-slate-600">
            {trip.notes}
          </div>
        )}

        <div className="mt-3 pt-3 border-t border-slate-100">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">
            {t("trip.driver")}
          </div>
          <div className="flex items-center gap-2.5">
            {trip.driver_photo ? (
              <img
                src={trip.driver_photo}
                alt={trip.driver_name ?? ""}
                className="w-10 h-10 rounded-full object-cover shrink-0 border border-slate-200"
              />
            ) : (
              <span className="w-10 h-10 rounded-full shrink-0 bg-brand-100 text-brand-700 font-bold text-sm flex items-center justify-center">
                {initials(trip.driver_name)}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-sm text-ink truncate">
                {trip.driver_name ?? "—"}
              </div>
              {trip.driver_rating ? (
                <div className="text-xs text-yellow-600 font-semibold">
                  {Number(trip.driver_rating).toFixed(1)} ★
                  <span className="text-slate-400 font-normal ml-1">
                    ({trip.driver_rating_count})
                  </span>
                </div>
              ) : (
                <div className="text-xs text-slate-400">{t("trip.newDriver")}</div>
              )}
            </div>
            <div className="text-right shrink-0 text-xs">
              <div className="text-slate-400">{trip.vehicle_make ?? trip.vehicle_label ?? "—"}</div>
              <div className="font-bold text-ink code-display text-[11px] mt-0.5">
                {trip.vehicle_plate ?? "—"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Carte de suivi (voyage en cours) */}
      {trip.status === "in_progress" &&
        Number.isFinite(trip.from_lat) &&
        Number.isFinite(trip.to_lat) && (
          <div className="card p-3.5">
            <h2 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">
              {t("trip.trackingMap")}
            </h2>
            <TrackingMap
              from={{ lat: trip.from_lat, lng: trip.from_lng, label: fromName }}
              to={{ lat: trip.to_lat, lng: trip.to_lng, label: toName }}
              driver={driverPos}
              height={240}
            />
            {!driverPos && (
              <p className="muted text-sm mt-2">{t("trip.waitingDriverPos")}</p>
            )}
          </div>
        )}

      {/* Confirmation directe / reçu / invite connexion */}
      {booking ? (
        <div id="receipt" className="card p-6 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 mb-3">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
          </div>
          <div className="font-bold text-ink text-lg">{t("booking.createSuccess")}</div>
          <div className="text-sm uppercase tracking-wider text-slate-400 mt-4 mb-2">
            {t("booking.yourCode")}
          </div>
          <div className="code-display text-4xl font-extrabold gradient-text mb-3">
            {booking.confirmation_code}
          </div>
          <p className="muted">{t("booking.saveCode")}</p>

          <div className="mt-5 text-left bg-slate-50 rounded-2xl p-4 text-sm space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-500">{fromName} → {toName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">{t("common.date")}</span>
              <span className="font-semibold">
                {relativeDateLabel(trip.depart_at)} · {formatPeriod(trip.depart_at)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">{t("common.seats")}</span>
              <span className="font-semibold">{booking.seats}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-1.5 mt-1.5">
              <span className="text-slate-500">{t("booking.total")}</span>
              <span className="font-extrabold text-brand-600">
                {formatPrice(trip.price_per_seat * booking.seats)}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2 mt-5 no-print">
            <div className="flex gap-2">
              <button onClick={handleCopy} className="btn-secondary flex-1">
                {copied ? t("common.copied") : t("common.copy")}
              </button>
              <button onClick={handleShare} className="btn-primary flex-1">
                {t("booking.shareCode")}
              </button>
            </div>
            <Link to="/reservation" className="btn-ghost">
              {t("nav.reservation")}
            </Link>
          </div>
        </div>
      ) : noSeats ? (
        !user ? (
          <div className="card p-6 text-center space-y-3">
            <p className="muted">{t("reservation.loginPrompt")}</p>
            <Link to="/login" state={{ from: `/trips/${trip.id}` }} className="btn-primary w-full">
              {t("auth.signIn")}
            </Link>
          </div>
        ) : (
          <div className="card p-6 text-center space-y-4">
            <p className="text-slate-600">{t("booking.noSeats")}</p>
            <p className="text-sm text-slate-500">{t("booking.waitingListHint")}</p>
            <button
              onClick={() => handleConfirm(true)}
              disabled={busy}
              className="btn-primary w-full"
            >
              {busy ? t("common.loading") : t("booking.joinWaitingList")}
            </button>
            {error && (
              <p className="text-sm text-rose-600 bg-rose-50 px-3 py-2 rounded-xl">{error}</p>
            )}
          </div>
        )
      ) : !user ? (
        <div className="card p-6 text-center space-y-3">
          <p className="muted">{t("reservation.loginPrompt")}</p>
          <Link
            to="/login"
            state={{ from: `/trips/${trip.id}` }}
            className="btn-primary w-full"
          >
            {t("auth.signIn")}
          </Link>
          <Link to="/register" className="btn-secondary w-full">
            {t("auth.signUp")}
          </Link>
        </div>
      ) : (
        <div className="card p-3 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-sm font-extrabold text-ink leading-tight">
                {t("booking.confirmTitle")}
              </h2>
              <p className="text-[10px] text-slate-500 mt-0.5">{t("booking.cashOnBoard")}</p>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-[10px] text-slate-400 mb-1">{t("booking.numberSeats")}</div>
              <div className="inline-flex items-center gap-1 rounded-xl bg-slate-50 border border-slate-100 px-1 py-0.5">
                <button
                  type="button"
                  onClick={() => setSeats((s) => Math.max(1, s - 1))}
                  className="w-7 h-7 rounded-lg text-base font-bold text-ink-soft active:scale-95 transition"
                  aria-label="−"
                >
                  −
                </button>
                <span className="min-w-[1.25rem] text-center text-lg font-extrabold text-ink">
                  {seats}
                </span>
                <button
                  type="button"
                  onClick={() => setSeats((s) => Math.min(maxSeats, s + 1))}
                  className="w-7 h-7 rounded-lg text-base font-bold text-ink-soft active:scale-95 transition"
                  aria-label="+"
                >
                  +
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                {trip.seats_available} {t("booking.seatRemaining")}
              </p>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
              {t("booking.notesOptional")}
            </label>
            <textarea
              rows={2}
              className="input mt-1 min-h-0 resize-none text-xs py-2 px-3 leading-snug"
              placeholder={t("booking.notesPlaceholder")}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2 text-xs">
            <span className="text-slate-500">
              {seats} × {formatPrice(trip.price_per_seat)}
            </span>
            <div className="text-right">
              <span className="text-[10px] text-slate-400 mr-1.5">{t("booking.total")}</span>
              <span className="text-base font-extrabold text-brand-600">
                {formatPrice(subtotal)}
              </span>
            </div>
          </div>

          {error && (
            <p className="text-[11px] text-rose-600 bg-rose-50 px-2.5 py-1.5 rounded-lg">
              {error}
            </p>
          )}

          <button
            onClick={() => handleConfirm()}
            disabled={busy}
            className="btn-primary w-full py-2.5 text-sm"
          >
            {busy ? t("common.loading") : t("booking.confirmBtn")}
          </button>
        </div>
      )}
    </div>
  );
}
