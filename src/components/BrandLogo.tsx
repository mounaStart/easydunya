import { cn } from "../lib/utils";
import { isNativePlatform } from "../lib/nativePush";
import { BRAND_BLUE, BRAND_ORANGE } from "../lib/brandColors";

const EMBLEM_URL =
  "https://easydunya.netlify.app/brand/emblem.png";

interface BrandLogoProps {
  showText?: boolean;
  showEmblem?: boolean;
  className?: string;
  emblemClassName?: string;
  textClassName?: string;
}

function BrandEmblem({ className }: { className?: string }) {
  const src = isNativePlatform() ? EMBLEM_URL : "/brand/emblem.png";
  return (
    <img
      src={src}
      alt=""
      width={48}
      height={32}
      decoding="async"
      className={cn(
        "shrink-0 h-8 w-auto sm:h-11 md:h-12 object-contain select-none",
        className
      )}
    />
  );
}

export default function BrandLogo({
  showText = true,
  showEmblem = true,
  className,
  emblemClassName,
  textClassName,
}: BrandLogoProps) {
  return (
    <div className={cn("flex items-center gap-1.5 sm:gap-2.5 min-w-0 max-w-full", className)}>
      {showEmblem && <BrandEmblem className={emblemClassName} />}
      {showText && (
        <span className={cn("text-sm sm:text-xl md:text-2xl font-extrabold tracking-tight leading-none truncate", textClassName)}>
          <span style={{ color: BRAND_BLUE }}>Easy</span>
          <span style={{ color: BRAND_ORANGE }}>Dunya</span>
        </span>
      )}
    </div>
  );
}
