import { useState, type FormEvent } from "react";
import { useAgency } from "../../lib/agency/useAgency";
import { upsertDriver } from "../../lib/agency/store";

export default function AgencyChauffeurs() {
  const { drivers, vehicles } = useAgency();
  const [open, setOpen] = useState(false);
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [phone, setPhone] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [err, setErr] = useState<string | null>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      upsertDriver({ first, last, phone, photo: null, vehicleId: vehicleId || null, active: true });
      setOpen(false);
      setFirst("");
      setLast("");
      setPhone("");
    } catch (er) {
      setErr(er instanceof Error ? er.message : "Erreur");
    }
  }

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button type="button" className="btn-primary text-sm" onClick={() => setOpen(true)}>
          Ajouter
        </button>
      </div>
      <div className="space-y-2">
        {drivers.map((d) => (
          <div key={d.id} className="card p-3 flex justify-between">
            <div>
              <div className="font-bold">
                {d.first} {d.last}
              </div>
              <div className="text-xs text-slate-500">{d.phone}</div>
            </div>
            <button
              type="button"
              className="text-xs"
              onClick={() => {
                try {
                  upsertDriver({ ...d, active: !d.active });
                } catch (e) {
                  alert(e instanceof Error ? e.message : "Erreur");
                }
              }}
            >
              {d.active ? "Retirer" : "Réactiver"}
            </button>
          </div>
        ))}
      </div>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <form onSubmit={submit} className="bg-white rounded-2xl p-5 w-full max-w-sm space-y-2">
            <h2 className="h2">Nouveau chauffeur</h2>
            <input className="input" value={first} onChange={(e) => setFirst(e.target.value)} placeholder="Prénom" required />
            <input className="input" value={last} onChange={(e) => setLast(e.target.value)} placeholder="Nom" required />
            <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Téléphone" required />
            <select className="input" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
              <option value="">Véhicule habituel</option>
              {vehicles
                .filter((v) => v.active)
                .map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plate}
                  </option>
                ))}
            </select>
            {err && <p className="text-sm text-rose-600">{err}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
                Fermer
              </button>
              <button className="btn-primary">Enregistrer</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
