import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { mapAuthError, isEmailLogin } from "../lib/authErrors";
import { postLoginPath } from "../lib/postLoginPath";
import { loginAgency, logoutAgency } from "../lib/agency/store";
import { useAuth } from "../hooks/useAuth";
import PasswordInput from "../components/PasswordInput";

function looksLikeAgencyIdent(login: string): boolean {
  const s = login.trim();
  if (!s || s.includes("@")) return false;
  return /[a-z.]/i.test(s);
}

export default function Login() {
  const { t } = useTranslation();
  const { signInWithPhone, signInWithEmail } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // Uniquement un chemin interne ("/…", pas "//host" ni "/\host") — jamais
  // une URL externe, pour empêcher toute redirection ouverte après connexion.
  const rawFrom = (location.state as { from?: string })?.from ?? "/";
  const from = /^\/(?![/\\])/.test(rawFrom) ? rawFrom : "/";

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const login = phone.trim();

    if (looksLikeAgencyIdent(login) || from.startsWith("/agence")) {
      const agency = loginAgency(login, password);
      if (!agency.error) {
        navigate(from.startsWith("/agence") ? from : "/agence", { replace: true });
        return;
      }
      if (looksLikeAgencyIdent(login)) {
        setLoading(false);
        setError(agency.error ?? t("auth.loginError"));
        return;
      }
    }

    const result = isEmailLogin(login)
      ? await signInWithEmail(login, password)
      : await signInWithPhone(login, password);

    if (result.error) {
      const agency = loginAgency(login, password);
      if (!agency.error) {
        navigate("/agence", { replace: true });
        return;
      }
      setLoading(false);
      setError(mapAuthError(result.error, result.code));
      return;
    }
    logoutAgency();
    navigate(postLoginPath(result.role, from), { replace: true });
  }

  return (
    <div className="page max-w-md">
      <div className="card p-6 sm:p-8">
        <h1 className="h1 mb-6">{t("auth.loginTitle")}</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">{t("common.phone")} / email admin</label>
            <input
              type="text"
              required
              inputMode="tel"
              autoComplete="username"
              placeholder="+222… ou admin@…"
              className="input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div>
            <label className="label">{t("common.password")}</label>
            <PasswordInput
              required
              autoComplete="current-password"
              value={password}
              onChange={setPassword}
            />
          </div>

          {error && (
            <p className="text-sm text-rose-600 bg-rose-50 px-3 py-2 rounded-lg">
              {error}
            </p>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? t("common.loading") : t("auth.signIn")}
          </button>
        </form>

        <p className="text-center mt-4">
          <Link to="/forgot-password" className="text-sm text-brand-700 font-semibold">
            {t("auth.forgotPassword")}
          </Link>
        </p>

        <p className="muted text-center mt-5 text-xs">{t("auth.agencyHint")}</p>

        <p className="muted text-center mt-5">
          {t("auth.noAccount")}{" "}
          <Link to="/register" className="text-brand-700 font-semibold">
            {t("auth.signUp")}
          </Link>
        </p>
        <p className="muted text-center mt-4 text-xs leading-relaxed">
          <Link to="/cgu" className="text-brand-700 font-semibold">
            {t("legal.cgu")}
          </Link>
          {" · "}
          <Link to="/confidentialite" className="text-brand-700 font-semibold">
            {t("legal.privacy")}
          </Link>
        </p>
      </div>
    </div>
  );
}
