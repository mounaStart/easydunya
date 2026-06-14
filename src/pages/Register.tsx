import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";
import { isValidPhone } from "../lib/phone";

export default function Register() {
  const { t } = useTranslation();
  const { signUpPassenger } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!fullName.trim()) {
      setError("Veuillez saisir votre nom complet.");
      return;
    }
    if (!isValidPhone(phone)) {
      setError("Numéro de téléphone invalide (8 à 15 chiffres).");
      return;
    }
    if (password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }

    setLoading(true);
    const { error } = await signUpPassenger({
      fullName: fullName.trim(),
      phone: phone.trim(),
      password,
    });
    setLoading(false);

    if (error) {
      setError(error);
      return;
    }
    navigate("/", { replace: true });
  }

  return (
    <div className="page max-w-md">
      <div className="card p-6 sm:p-8">
        <h1 className="h1 mb-1">{t("auth.registerTitle")}</h1>
        <p className="muted mb-6">{t("auth.passengerSignupHint")}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">{t("common.fullName")}</label>
            <input
              className="input"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="ex: Adama Ba"
            />
          </div>
          <div>
            <label className="label">{t("common.phone")}</label>
            <input
              className="input"
              required
              inputMode="tel"
              autoComplete="tel"
              placeholder="+222…"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div>
            <label className="label">{t("common.password")}</label>
            <input
              type="password"
              className="input"
              required
              minLength={6}
              autoComplete="new-password"
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
            {loading ? t("common.loading") : t("auth.signUp")}
          </button>
        </form>

        <p className="muted text-center mt-5">
          {t("auth.haveAccount")}{" "}
          <Link to="/login" className="text-brand-700 font-semibold">
            {t("auth.signIn")}
          </Link>
        </p>

        <p className="muted text-center mt-3 text-xs">
          {t("auth.driverByAdmin")}
        </p>
      </div>
    </div>
  );
}
