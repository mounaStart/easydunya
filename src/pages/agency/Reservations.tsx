import { useMemo, useState } from "react";
import { useAgency } from "../../lib/agency/useAgency";
import { refundForCancel } from "../../lib/agency/rules";
import { cancelBooking } from "../../lib/agency/store";
import { CHANNEL_COLOR, CHANNEL_LABEL } from "../../lib/agency/types";
import { formatPrice } from "../../lib/utils";

export default function AgencyReservations() {
  const { bookings, trips, agency } = useAgency();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [channel, setChannel] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const list = useMemo(
    () =>
      bookings.filter((b) => {
        if (status && b.status !== status) return false;
        if (channel && b.channel !== channel) return false;
        if (q && !`${b.passenger} ${b.phone} ${b.code}`.toLowerCase().includes(q.toLowerCase())) return false;
        return true;
      }),
    [bookings, q, status, channel]
  );
  const b = bookings.find((x) => x.id === selected);
  const t = trips.find((x) => x.id === b?.tripId);

  return (
    <div className="grid lg:grid-cols-[1fr_20rem] gap-4">
      <div>
        <div className="flex flex-wrap gap-2 mb-3">
          <input className="input flex-1 min-w-[10rem]" placeholder="Nom, tél, code" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="input w-36" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Tous statuts</option>
            <option value="confirmee">Confirmée</option>
            <option value="attente">En attente</option>
            <option value="annulee">Annulée</option>
            <option value="terminee">Terminée</option>
          </select>
          <select className="input w-36" value={channel} onChange={(e) => setChannel(e.target.value)}>
            <option value="">Tous canaux</option>
            <option value="app">App</option>
            <option value="guichet">Guichet</option>
            <option value="sous">Sous-agence</option>
          </select>
        </div>
        <div className="overflow-x-auto card">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400">
                <th className="p-2">Code</th>
                <th>Passager</th>
                <th>Places</th>
                <th>Canal</th>
                <th>Statut</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {list.map((row) => (
                <tr
                  key={row.id}
                  className="border-t border-slate-100 cursor-pointer hover:bg-slate-50"
                  onClick={() => setSelected(row.id)}
                >
                  <td className="p-2 font-mono text-xs">{row.code}</td>
                  <td>
                    {row.passenger}
                    <div className="text-[10px] text-slate-400">{row.phone}</div>
                  </td>
                  <td>{row.seatNos.join(", ")}</td>
                  <td style={{ color: CHANNEL_COLOR[row.channel] }}>{CHANNEL_LABEL[row.channel]}</td>
                  <td>{row.status}</td>
                  <td>{formatPrice(row.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <aside>
        {!b || !t || !agency ? (
          <p className="muted text-sm">Sélectionnez une réservation.</p>
        ) : (
          <div className="card p-4 space-y-2 text-sm">
            <div className="font-bold">{b.passenger}</div>
            <div className="text-xs text-slate-500">
              {b.code} · {b.phone}
            </div>
            <div>
              {t.fromName} → {t.toName}
            </div>
            <div>Places {b.seatNos.join(", ")}</div>
            <div>
              {formatPrice(b.total)} · {b.pay}
            </div>
            {b.status !== "annulee" && b.status !== "terminee" && (
              <button
                type="button"
                className="btn-ghost text-rose-700 text-sm"
                onClick={() => {
                  const rf = refundForCancel(agency, t, b);
                  if (!confirm(`Annuler ? Remboursement estimé ${formatPrice(rf.refund)}.`)) return;
                  try {
                    cancelBooking(b.id, "Annulation agence");
                  } catch (e) {
                    alert(e instanceof Error ? e.message : "Erreur");
                  }
                }}
              >
                Annuler
              </button>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
