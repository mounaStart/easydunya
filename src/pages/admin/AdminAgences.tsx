import { useEffect, useState, type FormEvent } from "react";
import {
  createAgencyByEasyDunya,
  getAgencyDb,
  resetAgencyDemo,
  setAgencyStatus,
  subscribeAgency,
} from "../../lib/agency/store";

export default function AdminAgences() {
  const [, setTick] = useState(0);
  useEffect(() => subscribeAgency(() => setTick((n) => n + 1)), []);
  const db = getAgencyDb();
  const [name, setName] = useState("");
  const [login, setLogin] = useState("");
  const [adminName, setAdminName] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("Nouakchott");
  const [password, setPassword] = useState("demo1234");
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    const r = createAgencyByEasyDunya({ name, address, city, email, login, adminName, password });
    if (r.error) setErr(r.error);
    else {
      setMsg(`Agence ${r.agency?.name} créée. Identifiant ${login}.`);
      setName("");
      setLogin("");
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-amber-50 text-amber-900 text-sm p-3">
        Démo locale (aperçu, sans SQL) : identifiants STV <strong>stv</strong>, <strong>stv.guichet</strong>,{" "}
        <strong>stv.tevragh</strong>, <strong>stv.embarq</strong> — mot de passe <strong>demo1234</strong>.
      </div>
      <div className="space-y-2">
        {db.agencies.map((a) => (
          <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 border border-slate-100 rounded-xl p-3">
            <div>
              <div className="font-bold">{a.name}</div>
              <div className="text-xs text-slate-500">
                {a.slug} · {a.city} · {a.status}
              </div>
            </div>
            <div className="flex gap-2">
              {a.status !== "approved" && (
                <button type="button" className="btn-primary text-xs" onClick={() => setAgencyStatus(a.id, "approved")}>
                  Approuver
                </button>
              )}
              {a.status !== "suspended" && (
                <button type="button" className="btn-ghost text-xs text-rose-700" onClick={() => setAgencyStatus(a.id, "suspended")}>
                  Suspendre
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      <form onSubmit={submit} className="space-y-2 max-w-md">
        <h3 className="font-bold">Créer une agence</h3>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom de l'agence" required />
        <input className="input" value={adminName} onChange={(e) => setAdminName(e.target.value)} placeholder="Nom de l'administrateur" required />
        <input className="input" value={login} onChange={(e) => setLogin(e.target.value)} placeholder="Identifiant de connexion" required />
        <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail" required />
        <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Adresse" required />
        <input className="input" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ville" />
        <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {err && <p className="text-sm text-rose-600">{err}</p>}
        {msg && <p className="text-sm text-emerald-700">{msg}</p>}
        <button className="btn-primary">Créer</button>
      </form>
      <button type="button" className="btn-ghost text-xs text-slate-500" onClick={() => resetAgencyDemo()}>
        Réinitialiser la démo STV
      </button>
    </div>
  );
}
