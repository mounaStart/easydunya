import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { findBookingByCode } from "../hooks/useBookings";
import type { Booking } from "../lib/types";
import StatusBadge from "../components/StatusBadge";
import { isValidConfirmationCode } from "../lib/codes";

export default function CheckBooking() {
  const { t } = useTranslation();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [booking, setBooking] = useState<Booking | null | undefined>(undefined);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isValidConfirmationCode(code)) {
      setBooking(null);
      return;
    }
    setLoading(true);
    const b = await findBookingByCode(code);
    setBooking(b);
    setLoading(false);
  }

  return (
    <div className="page max-w-lg">
      <div className="card p-6 sm:p-8">
        <h1 className="h1 mb-1">{t("booking.check.title")}</h1>
        <p className="muted mb-5">Easy Dunya</p>

        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
          <input
            className="input flex-1 uppercase tracking-widest font-bold text-center"
            placeholder={t("booking.check.placeholder")}
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s/g, ""))}
          />
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? t("common.loading") : t("booking.check.verify")}
          </button>
        </form>

        {booking === null && (
          <p className="mt-4 text-sm text-rose-700 bg-rose-50 rounded-lg px-3 py-2">
            {t("booking.check.notFound")}
          </p>
        )}

        {booking && (
          <div className="mt-5 bg-emerald-50 border border-emerald-100 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-emerald-800">
                ✓ {t("booking.check.found")}
              </span>
              <StatusBadge status={booking.status} />
            </div>
            <div className="text-sm text-slate-700 space-y-0.5">
              <div>
                <strong>{t("booking.yourCode")} :</strong>{" "}
                <span className="code-display font-bold">
                  {booking.confirmation_code}
                </span>
              </div>
              <div>
                <strong>{t("common.seats")} :</strong> {booking.seats}
              </div>
              {booking.guest_name && (
                <div>
                  <strong>{t("common.fullName")} :</strong> {booking.guest_name}
                </div>
              )}
              {booking.guest_phone && (
                <div>
                  <strong>{t("common.phone")} :</strong> {booking.guest_phone}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
