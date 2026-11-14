import { useMemo, useState } from "react";
import { useAgency } from "../../lib/agency/useAgency";
import { CHANNEL_COLOR, CHANNEL_LABEL } from "../../lib/agency/types";
import { formatPrice } from "../../lib/utils";

export default function AgencyRapports() {
  const { bookings, points } = useAgency();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const rows = useMemo(
    () =>
      bookings.filter((b) => {
        const d = b.createdAt.slice(0, 10);
        if (from && d < from) return false;
        if (to && d > to) return false;
        return true;
      }),
    [bookings, from, to]
  );
  const paid = rows.filter((b) => b.pay === "paye" || b.pay === "rembourse_partiel");
  const byCh = { app: 0, guichet: 0, sous: 0 };
  const byPt: Record<string, number> = {};
  let refunds = 0;
  for (const b of paid) {
    const amt = b.pay === "paye" ? b.total : b.total - (b.refund ?? 0);
    byCh[b.channel] += amt;
    if (b.pointId) byPt[b.pointId] = (byPt[b.pointId] ?? 0) + amt;
  }
  for (const b of rows) refunds += b.refund ?? 0;
  const total = byCh.app + byCh.guichet + byCh.sous;

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <button
          type="button"
          className="btn-ghost text-sm"
          onClick={() => {
            const csv = ["code,passager,canal,total,statut", ...rows.map((b) => `${b.code},${b.passenger},${b.channel},${b.total},${b.status}`)].join("\n");
            const blob = new Blob([csv], { type: "text/csv" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = "rapports-agence.csv";
            a.click();
          }}
        >
          Export CSV
        </button>
      </div>
      <div className="grid sm:grid-cols-4 gap-3">
        <div className="card p-3"><div className="text-xs text-slate-400">CA encaissé</div><div className="font-extrabold">{formatPrice(total)}</div></div>
        <div className="card p-3"><div className="text-xs text-slate-400">Remboursements</div><div className="font-extrabold">{formatPrice(refunds)}</div></div>
        <div className="card p-3"><div className="text-xs text-slate-400">Réservations</div><div className="font-extrabold">{rows.length}</div></div>
        <div className="card p-3"><div className="text-xs text-slate-400">Commission ED</div><div className="text-xs text-slate-500">À trancher</div></div>
      </div>
      <div className="grid sm:grid-cols-3 gap-2">
        {(["app", "guichet", "sous"] as const).map((c) => (
          <div key={c} className="card p-3">
            <div className="text-xs font-bold" style={{ color: CHANNEL_COLOR[c] }}>{CHANNEL_LABEL[c]}</div>
            <div className="font-extrabold">{formatPrice(byCh[c])}</div>
          </div>
        ))}
      </div>
      <div>
        <h3 className="h2 mb-2">Par point de vente</h3>
        {points.map((p) => (
          <div key={p.id} className="flex justify-between text-sm py-1">
            <span>{p.name}</span>
            <span className="font-semibold">{formatPrice(byPt[p.id] ?? 0)}</span>
          </div>
        ))}
        <div className="flex justify-between text-sm py-1">
          <span>Guichet principal</span>
          <span className="font-semibold">{formatPrice(byPt.principal ?? 0)}</span>
        </div>
      </div>
    </div>
  );
}
