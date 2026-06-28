import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";
import PasswordInput from "../components/PasswordInput";

export default function Login() {
  const { t } = useTranslation();
  const { signInWithPhone } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string })?.from ?? "/";

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function mapError(msg: string, code?: string): string {
    const lower = msg.toLowerCase();
    if (code === "email_not_confirmed" || lower.includes("not confirmed")) {
      return "Compte non confirmé. Contactez l'administrateur.";
    }
    if (
      code === "invalid_credentials" ||
      lower.includes("invalid login credentials")
    ) {
      return "Numéro de téléphone ou mot de passe incorrect.";
    }
    if (lower.includes("failed to fetch") || lower.includes("network")) {
      return "Impossible de joindre le serveur. Vérifiez votre connexion Internet.";
    }
    return msg;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error, code } = await signInWithPhone(phone.trim(), password);

    setLoading(false);
    if (error) {
      setError(mapError(error, code));
      return;
    }
    navigate(from, { replace: true });
  }

  return (
    <div className="page max-w-md">
      <div className="card p-6 sm:p-8">
        <h1 className="h1 mb-1">{t("auth.loginTitle")}</h1>
        <p className="muted mb-6">Easy Dunya</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">{t("common.phone")}</label>
            <input
              type="tel"
              required
              inputMode="tel"
              autoComplete="tel"
              placeholder="+222…"
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
