import { useTranslation } from "react-i18next";

/** Bandeau hero passager — image finale (texte inclus dans la photo) */
export default function PassengerHero() {
  const { t } = useTranslation();
  const heroAlt = `${t("search.heroTitle1")} ${t("search.heroTitle2a")}${t("search.heroTitle2b")}. ${t("search.heroSubtitleMockup")}`;

  return (
    <div className="relative w-full rounded-[20px] overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.12)] bg-[#0f2844] leading-[0]">
      <picture className="block w-full">
        <source srcSet="/brand/hero-home.webp?v=32 1024w" type="image/webp" />
        <img
          src="/brand/hero-home.jpg?v=32"
          alt={heroAlt}
          className="w-full h-auto block align-top"
          width={1024}
          height={682}
          sizes="379px"
          fetchPriority="high"
          decoding="async"
        />
      </picture>
    </div>
  );
}
