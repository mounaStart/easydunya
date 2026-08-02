import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { mapAuthError, isEmailLogin } from "../lib/authErrors";
import { useAuth } from "../hooks/useAuth";
import PasswordInput from "../components/PasswordInput";

export default function Login() {
  const { t } = useTranslation();
  const { signInWithPhone, signInWithEmail } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string })?.from ?? "/";

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const login = phone.trim();
    const result = isEmailLogin(login)
      ? await signInWithEmail(login, password)
      : await signInWithPhone(login, password);

    setLoading(false);
    if (result.error) {
      setError(mapAuthError(result.error, result.code));
      return;
    }
    navigate(from, { replace: true });
  }

  return (
    <div className="page max-w-md">
      <div className="card p-6 sm:p-8">
        <h1 className="h1 mb-1">{t("auth.loginTitle")}</h1>
        <p className="muted mb-6">
          Passagers et chauffeurs : téléphone + mot de passe. Admin : email ou téléphone.
        </p>

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

        <p className="muted text-center mt-5">
          {t("auth.noAccount")}{" "}
          <Link to="/register" className="text-brand-700 font-semibold">
            {t("auth.signUp")}
          </Link>
        </p>
      </div>
    </div>
  );
}
