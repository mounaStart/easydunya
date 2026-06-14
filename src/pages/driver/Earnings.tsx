import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";
import type { Payment } from "../../lib/types";
import Spinner from "../../components/Spinner";
import { formatPrice } from "../../lib/utils";

type Period = "week" | "month" | "all";

export default function DriverEarnings() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("month");

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    supabase
      .from("payments")
      .select("*")
      .eq("driver_id", user.id)
      .eq("status", "paid")
      .order("paid_at", { ascending: false })
      .then(({ data }) => {
        setPayments((data as Payment[] | null) ?? []);
        setLoading(false);
      });
  }, [user]);

  const filtered = useMemo(() => {
    if (period === "all") return payments;
    const now = Date.now();
    const ms = period === "week" ? 7 * 86400000 : 30 * 86400000;
    return payments.filter((p) => {
      const d = p.paid_at ? new Date(p.paid_at).getTime() : 0;
      return now - d <= ms;
    });
  }, [payments, period]);

  const totals = useMemo(() => {
    let gross = 0;
    let commission = 0;
    let net = 0;
    for (const p of filtered) {
      gross += p.amount;
      commission += p.commission;
      net += p.driver_earning;
    }
    return { gross, commission, net };
  }, [filtered]);

  if (loading) return <Spinner />;

  return (
    <div className="page max-w-2xl">
      <Link
        to="/driver"
        className="inline-flex items-center gap-2 -ml-1 px-2 py-2 text-base sm:text-lg font-semibold text-brand-700 hover:underline"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M11 18l-6-6 6-6"/></svg>
        {t("nav.dashboard")}
      </Link>
      <h1 className="h1 mt-3 mb-5">{t("driver.earningsTitle")}</h1>

      <div className="flex gap-2 mb-4 flex-wrap">
        {(["week", "month", "all"] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
              period === p ? "bg-brand-600 text-white" : "bg-white ring-1 ring-slate-200 text-slate-600"
            }`}
          >
            {t(`driver.period.${p}`)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="card p-4 text-center">
          <div className="text-xs text-slate-500">{t("driver.gross")}</div>
          <div className="text-lg font-bold text-ink">{formatPrice(totals.gross)}</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-xs text-slate-500">{t("driver.commission")}</div>
          <div className="text-lg font-bold text-rose-600">-{formatPrice(totals.commission)}</div>
        </div>
        <div className="card p-4 text-center bg-emerald-50 border-emerald-100">
          <div className="text-xs text-emerald-700">{t("driver.netEarnings")}</div>
          <div className="text-lg font-bold text-emerald-700">{formatPrice(totals.net)}</div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card p-8 text-center text-slate-500">{t("common.noResults")}</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => (
            <div key={p.id} className="card p-4 flex justify-between items-center">
              <div>
                <div className="font-semibold text-ink">{formatPrice(p.driver_earning)}</div>
                <div className="text-xs text-slate-500">
                  {p.paid_at ? new Date(p.paid_at).toLocaleDateString() : "—"} ·{" "}
                  {t("driver.commission")} {formatPrice(p.commission)}
                </div>
              </div>
              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full">
                {p.method === "cash" ? "💵 Cash" : p.method}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
