import { Link, useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../hooks/useAuth";
import { BRAND_GRADIENT_BR } from "../../lib/brandColors";
import { CONTACT_EMAIL } from "../../lib/contact";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100 last:border-0">
      <span className="text-slate-500 text-sm">{label}</span>
      <span className="font-semibold text-ink text-right max-w-[60%]">{value}</span>
    </div>
  );
}

function MenuLink({
  to,
  href,
  label,
  icon,
  external,
}: {
  to?: string;
  href?: string;
  label: string;
  icon: ReactNode;
  external?: boolean;
}) {
  const className =
    "w-full flex items-center gap-3 px-4 py-4 text-ink font-semibold hover:bg-slate-50 active:bg-slate-100 transition border-b border-slate-100 last:border-0";

  if (href) {
    return (
      <a
        href={href}
        className={className}
        target={external ? "_blank" : undefined}
        rel={external ? "noopener noreferrer" : undefined}
      >
        {icon}
        <span className="flex-1 text-left">{label}</span>
        <Chevron />
      </a>
    );
  }

  return (
    <Link to={to!} className={className}>
      {icon}
      <span className="flex-1 text-left">{label}</span>
      <Chevron />
    </Link>
  );
}

function Chevron() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-slate-400 shrink-0 rtl:rotate-180"
      aria-hidden
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

export default function Profile() {
  const { t, i18n } = useTranslation();
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();

  const isAdmin = profile?.role === "admin";
  const displayEmail =
    user?.email && !user.email.endsWith("@phone.easydunya.app") ? user.email : null;

  const name = profile?.full_name ?? profile?.phone ?? displayEmail ?? "—";
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

  const isPassenger = profile?.role === "passenger";

  async function handleLogout() {
    await signOut();
    navigate("/login", { replace: true });
  }

  return (
    <div className="page max-w-md space-y-4 pb-4">
      <div className="card p-6 text-center">
        <span
          className="w-20 h-20 rounded-full inline-flex items-center justify-center text-white font-bold text-3xl mb-3"
          style={{ backgroundImage: BRAND_GRADIENT_BR }}
        >
          {name.charAt(0).toUpperCase()}
        </span>
        <h1 className="text-xl font-extrabold text-ink">{name}</h1>
        <span className="chip mt-2">{roleLabel}</span>
      </div>

      <div className="card overflow-hidden">
        {isAdmin && displayEmail && (
          <Row label={t("common.email")} value={displayEmail} />
        )}
        <Row label={t("common.phone")} value={profile?.phone ?? "—"} />
        {isPassenger && (
          <>
            <Row label={t("profile.city")} value={profile?.city_label ?? "—"} />
            <Row label={t("profile.quartier")} value={profile?.quartier ?? "—"} />
          </>
        )}
        <Row label={t("profile.memberSince")} value={memberSince} />
      </div>

      {isPassenger && !profile?.quartier?.trim() && (
        <p className="text-xs text-slate-500 text-center px-2">{t("profile.locationHint")}</p>
      )}

      <div className="card overflow-hidden">
        <MenuLink
          to="/change-password"
          label={t("profile.changePassword")}
          icon={
            <span className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 inline-flex items-center justify-center shrink-0">
              🔒
            </span>
          }
        />
        <MenuLink
          to="/a-propos"
          label={t("profile.about")}
          icon={
            <span className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 inline-flex items-center justify-center shrink-0">
              ℹ️
            </span>
          }
        />
        <MenuLink
          href={`mailto:${CONTACT_EMAIL}`}
          label={t("profile.contactUs")}
          external
          icon={
            <span className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 inline-flex items-center justify-center shrink-0">
              ✉️
            </span>
          }
        />
      </div>

      <div className="card overflow-hidden">
        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-4 py-4 text-rose-600 font-semibold hover:bg-rose-50 active:bg-rose-100 transition"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
          </svg>
          {t("nav.logout")}
        </button>
      </div>
    </div>
  );
}
