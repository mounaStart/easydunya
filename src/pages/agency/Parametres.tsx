import { useState } from "react";
import { useAgency } from "../../lib/agency/useAgency";
import { resetAgencyDemo, saveAgencyProfile } from "../../lib/agency/store";

export default function AgencyParametres() {
  const { agency } = useAgency();
  const [cancelHours, setCancelHours] = useState(agency?.cancelHours ?? 6);
  const [cancelFee, setCancelFee] = useState(agency?.cancelFee ?? 10);
  const [msg, setMsg] = useState<string | null>(null);
  if (!agency) return null;

  return (
    <div className="space-y-6 max-w-lg">
      <section className="card p-4 space-y-3">
        <h2 className="h2">Agence</h2>
        <div className="text-sm">
          {agency.name} · {agency.slug.toUpperCase()}
        </div>
        <div className="text-xs text-slate-500">
          {agency.address} · {agency.phone}
        </div>
      </section>
      <section className="card p-4 space-y-3">
        <h2 className="h2">Annulation passager</h2>
        <label className="text-sm">
          Heures avant départ
          <input
            className="input mt-1"
            type="number"
            min={0}
            value={cancelHours}
            onChange={(e) => setCancelHours(Number(e.target.value))}
          />
        </label>
        <label className="text-sm">
          Frais %
          <input
            className="input mt-1"
            type="number"
            min={0}
            max={100}
            value={cancelFee}
            onChange={(e) => setCancelFee(Number(e.target.value))}
          />
        </label>
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            saveAgencyProfile({ cancelHours, cancelFee });
            setMsg("Enregistré");
          }}
        >
          Enregistrer
        </button>
        {msg && <p className="text-sm text-emerald-700">{msg}</p>}
      </section>
      <section className="card p-4">
        <h2 className="h2 mb-2">Démo</h2>
        <p className="text-sm text-slate-500 mb-2">Réinitialise l’agence STV (données locales de prévisualisation).</p>
        <button
          type="button"
          className="btn-ghost text-rose-700"
          onClick={() => {
            if (confirm("Réinitialiser les données démo ?")) resetAgencyDemo();
          }}
        >
          Réinitialiser la démo
        </button>
      </section>
    </div>
  );
}
