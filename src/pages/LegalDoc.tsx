import { Link, useNavigate } from "react-router-dom";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { CGU_V1_TEXT } from "../content/cguV1";
import { PRIVACY_V1_TEXT } from "../content/privacyV1";

type Kind = "cgu" | "privacy";

function formatBlocks(text: string): string[] {
  return text
    .split(/\n---\n/)
    .map((block) => block.trim())
    .filter(Boolean);
}

export default function LegalDoc({ kind }: { kind: Kind }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const text = kind === "cgu" ? CGU_V1_TEXT : PRIVACY_V1_TEXT;
  const title = kind === "cgu" ? t("legal.cgu") : t("legal.privacy");
  const blocks = useMemo(() => formatBlocks(text), [text]);

  return (
    <div className="page max-w-2xl space-y-4 pb-8">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 text-brand-700 font-semibold"
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="rtl:rotate-180"
        >
          <path d="M19 12H5M11 18l-6-6 6-6" />
        </svg>
        {t("common.back")}
      </button>

      <h1 className="h1">{title}</h1>
      <div className="space-y-4">
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
      <p className="text-center text-sm text-slate-500">
        {kind === "cgu" ? (
          <Link to="/confidentialite" className="text-brand-700 font-semibold">
            {t("legal.privacy")}
          </Link>
        ) : (
          <Link to="/cgu" className="text-brand-700 font-semibold">
            {t("legal.cgu")}
          </Link>
        )}
      </p>
    </div>
  );
}
