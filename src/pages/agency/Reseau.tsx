import { useState, type FormEvent } from "react";
import { useAgency } from "../../lib/agency/useAgency";
import { upsertPoint, upsertStaff } from "../../lib/agency/store";
import { PERM_PRESETS } from "../../lib/agency/types";

export default function AgencyReseau() {
  const { points, staffAll } = useAgency();
  const [pOpen, setPOpen] = useState(false);
  const [sOpen, setSOpen] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [login, setLogin] = useState("");
  const [display, setDisplay] = useState("");
  const [preset, setPreset] = useState<keyof typeof PERM_PRESETS>("vendeur");
  const [pointId, setPointId] = useState("principal");
  const [pass, setPass] = useState("demo1234");
  const [err, setErr] = useState<string | null>(null);

  function addP(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      upsertPoint({ name, address, phone, active: true });
      setPOpen(false);
      setName("");
    } catch (er) {
      setErr(er instanceof Error ? er.message : "Erreur");
    }
  }
  function addS(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      upsertStaff({
        name: display,
        login,
        email: `${login.trim().toLowerCase()}@agence.local`,
        password: pass,
        role: "agent",
        pointId: pointId || "principal",
        perms: PERM_PRESETS[preset].perms,
        active: true,
      });
      setSOpen(false);
    } catch (er) {
      setErr(er instanceof Error ? er.message : "Erreur");
    }
  }

  return (
    <div className="space-y-6">
      <section>
        <div className="flex justify-between mb-2">
          <h2 className="h2">Points de vente</h2>
          <button type="button" className="btn-primary text-sm" onClick={() => setPOpen(true)}>
            Ajouter un point
          </button>
        </div>
        {points.map((p) => (
          <div key={p.id} className="card p-3 mb-2 flex justify-between">
            <div>
              <div className="font-bold">{p.name}</div>
              <div className="text-xs text-slate-500">
                {p.address} · {p.phone}
              </div>
            </div>
            <button type="button" className="text-xs" onClick={() => upsertPoint({ ...p, active: !p.active })}>
              {p.active ? "Fermer" : "Rouvrir"}
            </button>
          </div>
        ))}
      </section>
      <section>
        <div className="flex justify-between mb-2">
          <h2 className="h2">Équipe</h2>
          <button type="button" className="btn-primary text-sm" onClick={() => setSOpen(true)}>
            Inviter
          </button>
        </div>
        {staffAll.map((s) => (
          <div key={s.id} className="card p-3 mb-2 flex justify-between">
            <div>
              <div className="font-bold">
                {s.name} <span className="text-xs font-normal text-slate-400">@{s.login}</span>
              </div>
              <div className="text-xs text-slate-500">{s.role}</div>
            </div>
            {s.role !== "admin" && (
              <button
                type="button"
                className="text-xs"
                onClick={() =>
                  upsertStaff({
                    id: s.id,
                    name: s.name,
                    login: s.login,
                    email: s.email,
                    role: s.role,
                    pointId: s.pointId,
                    perms: s.perms,
                    active: !s.active,
                  })
                }
              >
                {s.active ? "Désactiver" : "Activer"}
              </button>
            )}
          </div>
        ))}
      </section>
      {pOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <form onSubmit={addP} className="bg-white rounded-2xl p-5 w-full max-w-sm space-y-2">
            <h2 className="h2">Point de vente</h2>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom" required />
            <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Adresse" />
            <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Téléphone" />
            {err && <p className="text-sm text-rose-600">{err}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setPOpen(false)}>
                Fermer
              </button>
              <button className="btn-primary">Enregistrer</button>
            </div>
          </form>
        </div>
      )}
      {sOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <form onSubmit={addS} className="bg-white rounded-2xl p-5 w-full max-w-sm space-y-2">
            <h2 className="h2">Inviter un agent</h2>
            <input className="input" value={login} onChange={(e) => setLogin(e.target.value)} placeholder="Identifiant" required />
            <input className="input" value={display} onChange={(e) => setDisplay(e.target.value)} placeholder="Nom affiché" required />
            <input className="input" type="password" value={pass} onChange={(e) => setPass(e.target.value)} />
            <select className="input" value={preset} onChange={(e) => setPreset(e.target.value as typeof preset)}>
              {(Object.keys(PERM_PRESETS) as Array<keyof typeof PERM_PRESETS>).map((k) => (
                <option key={k} value={k}>
                  {PERM_PRESETS[k].label}
                </option>
              ))}
            </select>
            <select className="input" value={pointId} onChange={(e) => setPointId(e.target.value)}>
              <option value="principal">Guichet principal</option>
              {points
                .filter((p) => p.active)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
            {err && <p className="text-sm text-rose-600">{err}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setSOpen(false)}>
                Fermer
              </button>
              <button className="btn-primary">Inviter</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
