import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import type { UserAdmin, UserRole } from "../../lib/types";
import Spinner from "../../components/Spinner";

type RoleFilter = "all" | UserRole;

export default function AdminUsers() {
  const [users, setUsers] = useState<UserAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<RoleFilter>("all");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("users_admin")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (filter !== "all") q = q.eq("role", filter);

    const { data, error } = await q;
    if (error) {
      // Fallback profiles
      let pq = supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (filter !== "all") pq = pq.eq("role", filter);
      const { data: p } = await pq;
      setUsers(
        ((p ?? []) as Record<string, unknown>[]).map((row) => ({
          ...(row as object),
          email: "",
          last_sign_in_at: null,
          email_confirmed_at: null,
        })) as unknown as UserAdmin[]
      );
    } else {
      setUsers((data as UserAdmin[]) ?? []);
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = users.filter((u) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      (u.full_name ?? "").toLowerCase().includes(s) ||
      (u.email ?? "").toLowerCase().includes(s) ||
      (u.phone ?? "").toLowerCase().includes(s)
    );
  });

  async function changeRole(u: UserAdmin, role: UserRole) {
    if (!confirm(`Changer le rôle de ${u.full_name ?? u.email} en "${role}" ?`)) return;
    await supabase
      .from("profiles")
      .update({
        role,
        driver_status: role === "driver" ? "approved" : null,
      })
      .eq("id", u.id);
    load();
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {(["all", "passenger", "driver", "admin"] as RoleFilter[]).map((r) => (
          <button
            key={r}
            onClick={() => setFilter(r)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
              filter === r
                ? "bg-brand-600 text-white"
                : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {r === "all" ? "Tous" : r}
          </button>
        ))}
        <input
          type="text"
          placeholder="🔍 nom, email, téléphone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input ml-auto max-w-xs text-sm"
        />
      </div>

      {loading ? (
        <Spinner />
      ) : filtered.length === 0 ? (
        <div className="text-center text-slate-500 py-8">Aucun utilisateur.</div>
      ) : (
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-500 border-b border-slate-100">
              <tr>
                <th className="py-2 px-3">Nom</th>
                <th className="py-2 px-3">Email / Téléphone</th>
                <th className="py-2 px-3">Rôle</th>
                <th className="py-2 px-3">Inscrit</th>
                <th className="py-2 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr
                  key={u.id}
                  className="border-b border-slate-50 hover:bg-slate-50/50"
                >
                  <td className="py-2 px-3 font-medium text-slate-800">
                    {u.full_name ?? "—"}
                    {u.driver_status && (
                      <span className="ml-2 text-xs text-slate-400">
                        ({u.driver_status})
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-slate-600">
                    {u.email && <div>{u.email}</div>}
                    {u.phone && <div className="text-xs">{u.phone}</div>}
                  </td>
                  <td className="py-2 px-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        u.role === "admin"
                          ? "bg-purple-100 text-purple-700"
                          : u.role === "driver"
                          ? "bg-brand-100 text-brand-700"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-xs text-slate-500">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-2 px-3 text-right">
                    <select
                      defaultValue=""
                      onChange={(e) => {
                        const v = e.target.value as UserRole;
                        if (v && v !== u.role) changeRole(u, v);
                        e.target.value = "";
                      }}
                      className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white"
                    >
                      <option value="">Changer rôle…</option>
                      <option value="passenger">passenger</option>
                      <option value="driver">driver</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
