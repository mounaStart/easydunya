import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";
import type { UserRole } from "../lib/types";

export default function Register() {
  const { t } = useTranslation();
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const [role, setRole] = useState<UserRole>("passenger");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await signUp({ email, password, fullName, phone, role });
    setLoading(false);
    if (error) {
      setError(error);
      return;
    }
    if (role === "driver") {
      alert(t("auth.driverPending"));
    }
    navigate("/", { replace: true });
  }

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
            className={`btn ${
              role === "driver" ? "btn-primary" : "btn-secondary"
            }`}
          >
            🚗 {t("auth.registerAsDriver")}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">{t("common.fullName")}</label>
            <input className="input" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
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

          {error && (
            <p className="text-sm text-rose-600 bg-rose-50 px-3 py-2 rounded-lg">
              {error}
            </p>
          )}

          {role === "driver" && (
            <p className="text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-lg">
              ⚠ {t("auth.driverPending")}
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
