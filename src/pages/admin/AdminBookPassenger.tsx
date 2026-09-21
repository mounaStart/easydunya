import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useCities } from "../../hooks/useCities";
import { adminBookPassenger } from "../../lib/adminBooking";
import { isValidPhone, normalizePhone, phoneToCallBookingPassword } from "../../lib/phone";
import { restSelect } from "../../lib/supabaseRest";
import type { TripPublic } from "../../lib/types";
import {
  copyToClipboard,
  formatPeriod,
  formatPrice,
  isoToday,
  relativeDateLabel,
} from "../../lib/utils";
import Spinner from "../../components/Spinner";

type SuccessInfo = {
  confirmationCode: string;
  accountCreated: boolean;
  password: string | null;
  fullName: string;
  phone: string;
  seats: number;
  tripLabel: string;
};

export default function AdminBookPassenger() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const { cities } = useCities();
  const [trips, setTrips] = useState<TripPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [date, setDate] = useState("");
  const [selected, setSelected] = useState<TripPublic | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [seats, setSeats] = useState(1);
  const [quartier, setQuartier] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<SuccessInfo | null>(null);
  const [copied, setCopied] = useState<"code" | "password" | null>(null);

  const passwordPreview = phone ? phoneToCallBookingPassword(phone) : "";

  const load = useCallback(async () => {
    setLoading(true);
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const { data } = await restSelect<TripPublic>("trips_public", {
      select: "*",
      eq: { status: "scheduled" },
      gt: { seats_available: 0 },
      gte: { depart_at: startOfToday.toISOString() },
      order: "depart_at.asc",
      limit: 200,
    });
    setTrips(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    return trips.filter((tr) => {
      if (fromId && tr.from_city_id !== fromId) return false;
      if (toId && tr.to_city_id !== toId) return false;
      if (date) {
        const d = new Date(tr.depart_at);
        const localDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        if (localDate !== date) return false;
      }
      return true;
    });
  }, [trips, fromId, toId, date]);

  const cityName = (id: string) => {
    const c = cities.find((x) => x.id === id);
    if (!c) return "—";
    return isAr ? c.name_ar : c.name_fr;
  };

  function tripLabel(tr: TripPublic): string {
    const from = isAr ? tr.from_name_ar : tr.from_name_fr;
    const to = isAr ? tr.to_name_ar : tr.to_name_fr;
    return `${from} → ${to} · ${relativeDateLabel(tr.depart_at)} · ${formatPeriod(tr.depart_at)}`;
  }

  function startBooking(tr: TripPublic) {
    setSelected(tr);
    setError(null);
    setSuccess(null);
    setSeats(1);
    setCopied(null);
  }

  function resetForm() {
    setSelected(null);
    setFullName("");
    setPhone("");
    setSeats(1);
    setQuartier("");
    setError(null);
    setSuccess(null);
    setCopied(null);
  }

  async function submit() {
    if (!selected) return;
    setError(null);
    if (!fullName.trim()) {
      setError(t("admin.book.errName"));
      return;
    }
    if (!isValidPhone(phone)) {
      setError(t("admin.book.errPhone"));
      return;
    }
    if (seats < 1 || seats > selected.seats_available) {
      setError(t("admin.book.errSeats"));
      return;
    }
    setBusy(true);
    const result = await adminBookPassenger({
      tripId: selected.id,
      fullName: fullName.trim(),
      phone: phone.trim(),
      seats,
      pickupQuartier: quartier.trim() || undefined,
    });
    setBusy(false);
    if (result.error || !result.confirmationCode) {
      setError(result.error ?? t("admin.book.errGeneric"));
      return;
    }
    setSuccess({
      confirmationCode: result.confirmationCode,
      accountCreated: Boolean(result.accountCreated),
      password: result.password ?? (result.accountCreated ? passwordPreview : null),
      fullName: fullName.trim(),
      phone: normalizePhone(phone),
      seats,
      tripLabel: tripLabel(selected),
    });
    void load();
  }

  async function copy(kind: "code" | "password", value: string) {
    const ok = await copyToClipboard(value);
    if (ok) {
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 1600);
    }
  }

  return (
    <div>
      <div className="border border-brand-100 bg-brand-50/40 rounded-xl p-4 mb-4">
        <h3 className="font-bold text-ink">{t("admin.book.title")}</h3>
        <p className="text-sm text-slate-600 mt-1">{t("admin.book.subtitle")}</p>
      </div>

      {success ? (
        <div className="border border-emerald-200 bg-emerald-50 rounded-xl p-4 mb-4 space-y-3">
          <p className="font-bold text-emerald-800">{t("admin.book.successTitle")}</p>
          <p className="text-sm text-slate-700">{success.tripLabel}</p>
          <p className="text-sm text-slate-700">
            {success.fullName} · {success.phone} · {success.seats} {t("common.seats").toLowerCase()}
          </p>
          <div className="flex items-center justify-between gap-2 bg-white rounded-lg px-3 py-2 ring-1 ring-emerald-100">
            <div>
              <div className="text-xs text-slate-500">{t("admin.book.code")}</div>
              <div className="font-mono font-extrabold tracking-widest text-lg text-ink">
                {success.confirmationCode}
              </div>
            </div>
            <button
              type="button"
              className="btn-secondary text-xs"
              onClick={() => void copy("code", success.confirmationCode)}
            >
              {copied === "code" ? t("admin.book.copied") : t("admin.book.copy")}
            </button>
          </div>
          {success.accountCreated && success.password ? (
            <div className="flex items-center justify-between gap-2 bg-white rounded-lg px-3 py-2 ring-1 ring-emerald-100">
              <div>
                <div className="text-xs text-slate-500">{t("admin.book.password")}</div>
                <div className="font-mono font-extrabold text-lg text-ink">{success.password}</div>
                <p className="text-xs text-slate-500 mt-1">{t("admin.book.passwordHint")}</p>
              </div>
              <button
                type="button"
                className="btn-secondary text-xs shrink-0"
                onClick={() => void copy("password", success.password ?? "")}
              >
                {copied === "password" ? t("admin.book.copied") : t("admin.book.copy")}
              </button>
            </div>
          ) : (
            <p className="text-sm text-slate-600">{t("admin.book.existingAccount")}</p>
          )}
          <button type="button" className="btn-primary w-full" onClick={resetForm}>
            {t("admin.book.another")}
          </button>
        </div>
      ) : selected ? (
        <div className="border border-brand-100 bg-white rounded-xl p-4 mb-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <h3 className="font-bold text-ink">{t("admin.book.formTitle")}</h3>
              <p className="text-sm text-slate-600 mt-0.5">{tripLabel(selected)}</p>
              <p className="text-xs text-slate-500 mt-1">
                {formatPrice(selected.price_per_seat)}/{t("common.seats").toLowerCase()} ·{" "}
                {selected.seats_available}/{selected.seats_total} {t("common.seatsAvailable")}
              </p>
            </div>
            <button type="button" className="text-slate-400 text-sm" onClick={resetForm}>
              ✕
            </button>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="label">{t("common.fullName")} *</label>
              <input
                className="input"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
              />
            </div>
            <div>
              <label className="label">{t("common.phone")} *</label>
              <input
                className="input"
                inputMode="numeric"
                maxLength={8}
                placeholder="20000000"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 8))}
              />
            </div>
            <div>
              <label className="label">{t("common.seats")} *</label>
              <input
                type="number"
                min={1}
                max={selected.seats_available}
                className="input"
                value={seats}
                onChange={(e) => setSeats(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="label">{t("admin.book.quartier")}</label>
              <input
                className="input"
                value={quartier}
                onChange={(e) => setQuartier(e.target.value)}
                placeholder={t("admin.book.quartierPh")}
              />
            </div>
          </div>
          {passwordPreview && (
            <p className="text-xs text-slate-500 mt-3">
              {t("admin.book.passwordPreview")}:{" "}
              <span className="font-mono font-semibold text-ink">{passwordPreview}</span>
            </p>
          )}
          {error && (
            <p className="text-sm text-rose-700 bg-rose-50 px-3 py-2 rounded-lg mt-3">{error}</p>
          )}
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy}
            className="btn-primary w-full mt-3"
          >
            {busy ? t("admin.book.saving") : t("admin.book.submit")}
          </button>
        </div>
      ) : null}

      <div className="grid sm:grid-cols-3 gap-3 mb-4">
        <select className="input" value={fromId} onChange={(e) => setFromId(e.target.value)}>
          <option value="">{t("search.fromCity")}</option>
          {cities.map((c) => (
            <option key={c.id} value={c.id}>
              {cityName(c.id)}
            </option>
          ))}
        </select>
        <select className="input" value={toId} onChange={(e) => setToId(e.target.value)}>
          <option value="">{t("search.toCity")}</option>
          {cities.map((c) => (
            <option key={c.id} value={c.id}>
              {cityName(c.id)}
            </option>
          ))}
        </select>
        <input
          type="date"
          className="input"
          min={isoToday()}
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      {loading ? (
        <Spinner />
      ) : filtered.length === 0 ? (
        <div className="text-center text-slate-500 py-8">{t("admin.book.noTrips")}</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((tr) => (
            <div
              key={tr.id}
              className={`border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                selected?.id === tr.id ? "border-brand-400 bg-brand-50/40" : "border-slate-100"
              }`}
            >
              <div className="min-w-0">
                <div className="font-semibold text-slate-900">
                  {isAr ? tr.from_name_ar : tr.from_name_fr}
                  <span className="mx-1 text-brand-500">→</span>
                  {isAr ? tr.to_name_ar : tr.to_name_fr}
                </div>
                <div className="text-sm text-slate-500 flex items-center gap-3 flex-wrap mt-0.5">
                  <span>
                    {relativeDateLabel(tr.depart_at)} · {formatPeriod(tr.depart_at)}
                  </span>
                  <span>👤 {tr.driver_name ?? "—"}</span>
                  <span>
                    {formatPrice(tr.price_per_seat)}/{t("common.seats").toLowerCase()}
                  </span>
                  <span>
                    {tr.seats_available}/{tr.seats_total} {t("common.seatsAvailable")}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="btn-primary text-sm shrink-0"
                onClick={() => startBooking(tr)}
              >
                {t("admin.book.choose")}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
