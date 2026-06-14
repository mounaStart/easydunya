import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useTrip } from "../hooks/useTrips";
import { useAuth } from "../hooks/useAuth";
import { createBooking, rememberBookingCode } from "../hooks/useBookings";
import { getCurrentPosition, reverseQuartier } from "../lib/geocode";
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
    <div className="flex items-center gap-3 bg-slate-50 rounded-2xl px-4 py-3">
      <span className="icon-tile-soft w-10 h-10 shrink-0">{icon}</span>
      <div>
        <div className="text-xs text-slate-400">{label}</div>
        <div className="font-bold text-ink">{value}</div>
      </div>
    </div>
  );
}

export default function TripDetail() {
  const { tripId } = useParams();
  const { trip, loading } = useTrip(tripId);
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
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

    let pickupLat: number | undefined;
    let pickupLng: number | undefined;
    let pickupQuartier: string | undefined;
    try {
      const pos = await getCurrentPosition();
      pickupLat = pos.coords.latitude;
      pickupLng = pos.coords.longitude;
      pickupQuartier = (await reverseQuartier(pickupLat, pickupLng)) ?? undefined;
    } catch {
      /* GPS optionnel */
    }

    const { booking, error } = await createBooking({
      tripId: trip.id,
      seats,
      passengerId: user.id,
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
    <div className="page max-w-2xl space-y-4">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 text-ink font-semibold"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M11 18l-6-6 6-6"/></svg>
        {t("common.back")}
      </button>

      {/* En-tête voyage */}
      <div className="card p-6">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-extrabold text-ink leading-tight">
            {fromName}
            <span className="mx-2 text-slate-400">→</span>
            {toName}
          </h1>
          <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${statusClass}`}>
            {statusLabel}
          </span>
        </div>
        <div className="muted mt-1">{relativeDateLabel(trip.depart_at)}</div>

        <div className="grid sm:grid-cols-3 gap-3 mt-5">
          <InfoRow
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>}
            label={t("trip.departure")}
            value={formatPeriod(trip.depart_at)}
          />
          <InfoRow
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-3-3.87M2 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2"/><circle cx="9" cy="7" r="4"/></svg>}
            label={t("trip.places")}
            value={`${trip.seats_available} / ${trip.seats_total}`}
          />
          <InfoRow
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>}
            label={t("common.price")}
            value={formatPrice(trip.price_per_seat)}
          />
        </div>

        {trip.notes && (
          <div className="mt-4 bg-slate-50 rounded-2xl px-4 py-3 text-sm text-slate-600">
            {trip.notes}
          </div>
        )}
      </div>

      {/* Carte de suivi (voyage en cours) */}
      {trip.status === "in_progress" &&
        Number.isFinite(trip.from_lat) &&
        Number.isFinite(trip.to_lat) && (
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">
              {t("trip.trackingMap")}
            </h2>
            <TrackingMap
              from={{ lat: trip.from_lat, lng: trip.from_lng, label: fromName }}
              to={{ lat: trip.to_lat, lng: trip.to_lng, label: toName }}
              driver={driverPos}
            />
            {!driverPos && (
              <p className="muted text-sm mt-2">{t("trip.waitingDriverPos")}</p>
            )}
          </div>
        )}

      {/* Chauffeur & véhicule (sans numéro de téléphone) */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">
          {t("trip.driver")}
        </h2>
        <div className="flex items-center gap-3">
          {trip.driver_photo ? (
            <img
              src={trip.driver_photo}
              alt={trip.driver_name ?? ""}
              className="w-14 h-14 rounded-full object-cover shrink-0 border border-slate-200"
            />
          ) : (
            <span className="w-14 h-14 rounded-full shrink-0 bg-brand-100 text-brand-700 font-extrabold text-lg flex items-center justify-center">
              {initials(trip.driver_name)}
            </span>
          )}
          <div className="min-w-0">
            <div className="font-bold text-ink truncate">
              {trip.driver_name ?? "—"}
            </div>
            {trip.driver_rating ? (
              <div className="text-sm text-yellow-600 font-semibold">
                {Number(trip.driver_rating).toFixed(1)} ★
                <span className="text-slate-400 font-normal ml-1">
                  ({trip.driver_rating_count})
                </span>
              </div>
            ) : (
              <div className="text-sm text-slate-400">
                {t("trip.newDriver")}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="bg-slate-50 rounded-2xl px-4 py-3">
            <div className="text-xs text-slate-400">{t("trip.vehicleMake")}</div>
            <div className="font-bold text-ink">
              {trip.vehicle_make ?? trip.vehicle_label ?? "—"}
            </div>
          </div>
          <div className="bg-slate-50 rounded-2xl px-4 py-3">
            <div className="text-xs text-slate-400">{t("trip.vehiclePlate")}</div>
            <div className="font-bold text-ink code-display">
              {trip.vehicle_plate ?? "—"}
            </div>
          </div>
        </div>
      </div>

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
        <div className="card p-5 sm:p-6 space-y-5">
          <div>
            <h2 className="text-xl font-extrabold text-ink">
              {t("booking.confirmTitle")}
            </h2>
            <p className="muted">{t("booking.cashOnBoard")}</p>
          </div>

          {/* Stepper places */}
          <div>
            <label className="label">{t("booking.numberSeats")}</label>
            <div className="flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => setSeats((s) => Math.max(1, s - 1))}
                className="w-12 h-12 rounded-2xl border border-slate-200 text-2xl font-bold text-ink-soft active:scale-95 transition"
              >
                −
              </button>
              <span className="text-3xl font-extrabold text-ink">{seats}</span>
              <button
                type="button"
                onClick={() => setSeats((s) => Math.min(maxSeats, s + 1))}
                className="w-12 h-12 rounded-2xl border border-slate-200 text-2xl font-bold text-ink-soft active:scale-95 transition"
              >
                +
              </button>
            </div>
            <p className="muted mt-2">
              {trip.seats_available} {t("booking.seatRemaining")}
            </p>
          </div>

          {/* Notes */}
          <div>
            <label className="label">{t("booking.notesOptional")}</label>
            <textarea
              className="input min-h-[90px] resize-none"
              placeholder={t("booking.notesPlaceholder")}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Détail prix */}
          <div className="border-t border-slate-100 pt-4 space-y-2 text-sm">
            <div className="flex justify-between text-slate-500">
              <span>{seats} × {formatPrice(trip.price_per_seat)}</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
            <div className="flex justify-between items-center border-t border-slate-100 pt-3">
              <span className="font-bold text-ink">{t("booking.total")}</span>
              <span className="text-xl font-extrabold text-brand-600">
                {formatPrice(subtotal)}
              </span>
            </div>
          </div>

          {error && (
            <p className="text-sm text-rose-600 bg-rose-50 px-3 py-2 rounded-xl">
              {error}
            </p>
          )}

          <button
            onClick={() => handleConfirm()}
            disabled={busy}
            className="btn-primary w-full py-4"
          >
            {busy ? t("common.loading") : t("booking.confirmBtn")}
          </button>
        </div>
      )}
    </div>
  );
}
