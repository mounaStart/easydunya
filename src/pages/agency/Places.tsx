import { useState } from "react";
import SeatMap from "../../components/agency/SeatMap";
import { useAgency } from "../../lib/agency/useAgency";
import { freeSeatCount, seatsByChannel } from "../../lib/agency/rules";
import { CHANNEL_COLOR, CHANNEL_LABEL } from "../../lib/agency/types";

export default function AgencyPlaces() {
  const { trips, db } = useAgency();
  const upcoming = trips
    .filter((t) => t.status === "publie" && new Date(t.departAt).getTime() > Date.now())
    .sort((a, b) => a.departAt.localeCompare(b.departAt));
  const [id, setId] = useState(upcoming[0]?.id ?? "");
  const trip = trips.find((t) => t.id === id) ?? upcoming[0];
  const ch = trip ? seatsByChannel(db, trip.id) : null;

  return (
    <div className="space-y-4">
      <select className="input" value={trip?.id ?? ""} onChange={(e) => setId(e.target.value)}>
        {upcoming.map((t) => (
          <option key={t.id} value={t.id}>
            {t.fromName} → {t.toName} · {new Date(t.departAt).toLocaleString("fr-FR")} · {freeSeatCount(db, t)} lib.
          </option>
        ))}
      </select>
      {!trip ? (
        <p className="muted">Aucun départ à venir.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-3 text-xs font-semibold">
            {(["app", "guichet", "sous"] as const).map((c) => (
              <span key={c} className="inline-flex items-center gap-1">
                <i className="w-3 h-3 rounded-sm inline-block" style={{ background: CHANNEL_COLOR[c] }} />
                {CHANNEL_LABEL[c]} {ch?.[c]}
              </span>
            ))}
            <span>Libre {ch?.libre}</span>
            <span className="text-slate-400">Hachuré = en attente de paiement</span>
          </div>
          <div className="card p-4 overflow-x-auto">
            <SeatMap db={db} trip={trip} />
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400">
                <th className="py-1">Départ</th>
                <th>App</th>
                <th>Guichet</th>
                <th>Sous</th>
                <th>Libres</th>
              </tr>
            </thead>
            <tbody>
              {upcoming.map((t) => {
                const c = seatsByChannel(db, t.id);
                return (
                  <tr key={t.id} className="border-t border-slate-100">
                    <td className="py-2">{t.fromName} → {t.toName}</td>
                    <td>{c.app}</td>
                    <td>{c.guichet}</td>
                    <td>{c.sous}</td>
                    <td>{c.libre}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
