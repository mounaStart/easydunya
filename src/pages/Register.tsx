import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";
import { useCities } from "../hooks/useCities";
import type { UserRole } from "../lib/types";

export default function Register() {
  const { t, i18n } = useTranslation();
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const { cities } = useCities();

  const [role, setRole] = useState<UserRole>("passenger");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [baseCityId, setBaseCityId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  function validatePhone(p: string): string | null {
    const cleaned = p.replace(/[\s.-]/g, "");
    if (!/^\+?[0-9]{8,15}$/.test(cleaned)) {
      return "Numéro de téléphone invalide (8 à 15 chiffres, indicatif autorisé).";
    }
    return null;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    const phoneErr = validatePhone(phone);
    if (phoneErr) {
      setError(phoneErr);
      return;
    }

    if (role === "driver" && !licenseNumber.trim()) {
      setError("Le numéro de permis est obligatoire pour les chauffeurs.");
      return;
    }

    setLoading(true);
    const { error, needsEmailConfirm } = await signUp({
      email,
      password,
      fullName,
      phone,
      role,
      licenseNumber: licenseNumber.trim() || undefined,
      baseCityId: baseCityId || undefined,
    });
    setLoading(false);

    if (error) {
      setError(error);
      return;
    }

    if (needsEmailConfirm) {
      setInfo(
        `Compte créé ! Vérifiez votre boîte mail (${email}) et cliquez sur le lien de confirmation, puis revenez vous connecter. ` +
          `(Astuce dev : Supabase → Authentication → Providers → Email → décocher "Confirm email".)`
      );
      return;
    }

    // Redirection adaptée au rôle
    if (role === "driver") {
      navigate("/driver", { replace: true });
    } else {
      navigate("/", { replace: true });
    }
  }

  const isDriver = role === "driver";

  return (
    <div className="page max-w-md">
      <div className="card p-6 sm:p-8">
        <h1 className="h1 mb-1">{t("auth.registerTitle")}</h1>
        <p className="muted mb-5">Easy Dunya</p>

        <div className="grid grid-cols-2 gap-2 mb-5">
          <button
            type="button"
            onClick={() => setRole("passenger")}
            className={`btn ${
              role === "passenger" ? "btn-primary" : "btn-secondary"
            }`}
          >
            🧳 {t("auth.registerAsPassenger")}
          </button>
          <button
            type="button"
            onClick={() => setRole("driver")}
            className={`btn ${isDriver ? "btn-primary" : "btn-secondary"}`}
          >
            🚗 {t("auth.registerAsDriver")}
          </button>
        </div>

        {isDriver && (
          <div className="mb-4 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
            <strong>ℹ Validation requise :</strong> votre compte chauffeur sera
            créé en statut « en attente ». L'équipe Easy Dunya vous validera
            sous 24 h. Vous pourrez vous connecter immédiatement mais ne pourrez
            publier des voyages qu'après validation.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">{t("common.fullName")}</label>
            <input
              className="input"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <div>
            <label className="label">{t("common.phone")}</label>
            <input
              className="input"
              required
              placeholder="+222…"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div>
            <label className="label">{t("common.email")}</label>
            <input
              type="email"
              className="input"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="label">{t("common.password")}</label>
            <input
              type="password"
              className="input"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {isDriver && (
            <>
              <div className="pt-2 border-t border-slate-100">
                <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold mb-3">
                  Informations chauffeur
                </p>
              </div>
              <div>
                <label className="label">
                  Numéro de permis de conduire
                  <span className="text-rose-500"> *</span>
                </label>
                <input
                  className="input"
                  required
                  value={licenseNumber}
                  onChange={(e) => setLicenseNumber(e.target.value)}
                  placeholder="ex: MR-12345-2023"
                />
              </div>
              <div>
                <label className="label">Ville de base</label>
                <select
                  className="input"
                  value={baseCityId}
                  onChange={(e) => setBaseCityId(e.target.value)}
                >
                  <option value="">— Sélectionner —</option>
                  {cities.map((c) => (
                    <option key={c.id} value={c.id}>
                      {i18n.language === "ar" ? c.name_ar : c.name_fr}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {error && (
            <p className="text-sm text-rose-600 bg-rose-50 px-3 py-2 rounded-lg">
              {error}
            </p>
          )}

          {info && (
            <p className="text-sm text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg">
              ✓ {info}
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
      </div>
    </div>
  );
}
