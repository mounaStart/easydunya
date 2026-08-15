import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";
import PasswordInput from "../components/PasswordInput";
import { isValidPhone } from "../lib/phone";

export default function ForgotPassword() {
  const { t } = useTranslation();
  const { resetPasswordByPhone } = useAuth();
  const navigate = useNavigate();

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!isValidPhone(phone)) {
      setError("Numéro de téléphone invalide.");
      return;
    }
    if (password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }
    if (password !== confirm) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    const { error: err } = await resetPasswordByPhone(phone.trim(), password);
    setLoading(false);

    if (err) {
      setError(err);
      return;
    }
    setDone(true);
  }

  return (
    <div className="page max-w-md">
      <div className="card p-6 sm:p-8">
        <h1 className="h1 mb-1">{t("auth.forgotPasswordTitle")}</h1>
        <p className="muted mb-6">{t("auth.forgotPasswordHint")}</p>

        {done ? (
          <div className="space-y-4 text-center">
            <p className="text-emerald-700 bg-emerald-50 rounded-xl px-4 py-3 text-sm">
              {t("auth.forgotPasswordSuccess")}
            </p>
            <Link to="/login" className="btn-primary w-full inline-flex">
              {t("auth.signIn")}
            </Link>
          </div>
        ) : (
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
              <label className="label">{t("auth.newPassword")}</label>
              <PasswordInput
                required
                autoComplete="new-password"
                value={password}
                onChange={setPassword}
              />
            </div>
            <div>
              <label className="label">{t("auth.confirmPassword")}</label>
              <PasswordInput
                required
                autoComplete="new-password"
                value={confirm}
                onChange={setConfirm}
              />
            </div>

            {error && (
              <p className="text-sm text-rose-600 bg-rose-50 px-3 py-2 rounded-lg">{error}</p>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? t("common.loading") : t("auth.resetPassword")}
            </button>
          </form>
        )}

        <p className="muted text-center mt-5">
          <Link to="/login" className="text-brand-700 font-semibold">
            ← {t("auth.signIn")}
          </Link>
        </p>
      </div>
    </div>
  );
}
