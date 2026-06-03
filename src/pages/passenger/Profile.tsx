import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../hooks/useAuth";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100 last:border-0">
      <span className="text-slate-500 text-sm">{label}</span>
      <span className="font-semibold text-ink">{value}</span>
    </div>
  );
}

export default function Profile() {
  const { t, i18n } = useTranslation();
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();

  const name = profile?.full_name ?? user?.email ?? "—";
  const roleLabel =
    profile?.role === "driver"
      ? t("auth.registerAsDriver")
      : profile?.role === "admin"
        ? t("admin.dashboard")
        : t("auth.registerAsPassenger");

  const memberSince = profile?.created_at
    ? new Intl.DateTimeFormat(i18n.language === "ar" ? "ar-MR" : "fr-FR", {
        year: "numeric",
        month: "long",
      }).format(new Date(profile.created_at))
    : "—";

  async function handleLogout() {
    await signOut();
    navigate("/");
  }

  return (
    <div className="page max-w-md space-y-4">
      <div className="card p-6 text-center">
        <span
          className="w-20 h-20 rounded-full inline-flex items-center justify-center text-white font-bold text-3xl mb-3"
          style={{ backgroundImage: "linear-gradient(135deg,#1e88d6,#f97316)" }}
        >
          {name.charAt(0).toUpperCase()}
        </span>
        <h1 className="text-xl font-extrabold text-ink">{name}</h1>
        <span className="chip mt-2">{roleLabel}</span>
      </div>

      <div className="card overflow-hidden">
        <Row label={t("common.email")} value={user?.email ?? "—"} />
        <Row label={t("common.phone")} value={profile?.phone ?? "—"} />
        <Row label={t("profile.memberSince")} value={memberSince} />
      </div>

      <button onClick={handleLogout} className="btn-secondary w-full text-rose-600">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>
        {t("profile.logout")}
      </button>
    </div>
  );
}
