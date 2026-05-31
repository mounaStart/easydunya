import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";

export default function Login() {
  const { t } = useTranslation();
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string })?.from ?? "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      setError(t("auth.loginError"));
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
            <label className="label">{t("common.email")}</label>
            <input
              type="email"
              required
              autoComplete="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="label">{t("common.password")}</label>
            <input
              type="password"
              required
              autoComplete="current-password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
