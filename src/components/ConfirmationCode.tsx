import { useState } from "react";
import { useTranslation } from "react-i18next";
import { copyToClipboard, shareViaWhatsApp } from "../lib/utils";

interface Props {
  code: string;
  passengerName?: string;
  fromName?: string;
  toName?: string;
}

export default function ConfirmationCode({
  code,
  passengerName,
  fromName,
  toName,
}: Props) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const ok = await copyToClipboard(code);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  }

  function handleShare() {
    const lines = [
      `Easy Dunya — ${t("booking.title")}`,
      passengerName ? `${t("common.fullName")}: ${passengerName}` : null,
      fromName && toName ? `${fromName} → ${toName}` : null,
      `${t("booking.yourCode")}: ${code}`,
    ].filter(Boolean);
    shareViaWhatsApp(lines.join("\n"));
  }

  return (
    <div className="card p-6 text-center">
      <div className="text-sm uppercase tracking-wider text-slate-500 mb-3">
        {t("booking.yourCode")}
      </div>
      <div className="code-display text-4xl sm:text-5xl font-bold text-brand-700 mb-3">
        {code}
      </div>
      <p className="muted mb-5">{t("booking.saveCode")}</p>
      <div className="flex flex-wrap gap-2 justify-center">
        <button onClick={handleCopy} className="btn-secondary">
          {copied ? t("common.copied") : t("common.copy")}
        </button>
        <button onClick={handleShare} className="btn-primary">
          {t("booking.shareCode")}
        </button>
      </div>
    </div>
  );
}
