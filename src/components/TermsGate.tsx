import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { CGU_V1_TEXT } from "../content/cguV1";
import { acceptTerms } from "../lib/termsAcceptance";
import { exitApplication } from "../lib/exitApp";
import { useAuth } from "../hooks/useAuth";

type Props = {
  onAccepted: () => void;
};

function formatCguBlocks(text: string): string[] {
  return text
    .split(/\n---\n/)
    .map((block) => block.trim())
    .filter(Boolean);
}

export default function TermsGate({ onAccepted }: Props) {
  const { t } = useTranslation();
  const { user, profile, refreshProfile } = useAuth();
  const isDriver = profile?.role === "driver";

  const [acceptCgu, setAcceptCgu] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [acceptDriver, setAcceptDriver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const blocks = useMemo(() => formatCguBlocks(CGU_V1_TEXT), []);

  const canAccept =
    acceptCgu && acceptPrivacy && (!isDriver || acceptDriver) && !busy;

  async function handleAccept() {
    if (!canAccept) return;
    setBusy(true);
    setError(null);
    try {
      const { error: acceptError } = await acceptTerms({ userId: user?.id });
      if (acceptError) {
        setError(acceptError);
        return;
      }
      if (user) await refreshProfile();
      onAccepted();
    } finally {
      setBusy(false);
    }
  }

  async function handleDecline() {
    if (busy) return;
    setBusy(true);
    try {
      await exitApplication();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-slate-50">
      <header className="shrink-0 border-b border-slate-200 bg-white px-4 py-4 safe-top">
        <h1 className="text-lg font-bold text-ink text-center">
          {t("terms.title")}
        </h1>
        <p className="text-sm text-slate-500 text-center mt-1">
          {t("terms.subtitle")}
        </p>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto max-w-2xl space-y-4">
          {blocks.map((block, index) => (
            <section
              key={index}
              className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100"
            >
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-700">
                {block}
              </pre>
            </section>
          ))}
        </div>
      </div>

      <footer className="shrink-0 border-t border-slate-200 bg-white px-4 py-4 safe-bottom">
        <div className="mx-auto max-w-2xl space-y-3">
          {error && (
            <p className="text-sm text-rose-600 bg-rose-50 rounded-xl px-3 py-2">
              {error}
            </p>
          )}

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={acceptCgu}
              onChange={(e) => setAcceptCgu(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            <span className="text-sm text-slate-700">{t("terms.acceptCgu")}</span>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={acceptPrivacy}
              onChange={(e) => setAcceptPrivacy(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            <span className="text-sm text-slate-700">
              {t("terms.acceptPrivacy")}
            </span>
          </label>

          {isDriver && (
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptDriver}
                onChange={(e) => setAcceptDriver(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              <span className="text-sm text-slate-700">
                {t("terms.acceptDriver")}
              </span>
            </label>
          )}

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={() => void handleDecline()}
              disabled={busy}
              className="inline-flex items-center justify-center rounded-2xl px-4 py-3 font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition disabled:opacity-60"
            >
              {t("terms.decline")}
            </button>
            <button
              type="button"
              onClick={() => void handleAccept()}
              disabled={!canAccept}
              className="inline-flex items-center justify-center rounded-2xl px-4 py-3 font-semibold text-white bg-brand-600 hover:bg-brand-700 transition disabled:opacity-50"
            >
              {t("terms.accept")}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
