import { cn } from "../lib/utils";

interface BrandLogoProps {
  /** Afficher le texte « EasyDunya » à côté de l’emblème */
  showText?: boolean;
  className?: string;
  emblemClassName?: string;
}

/** Emblème officiel Easy Dunya (globe, ville, voiture, pin). Ratio source 3:2. */
function BrandEmblem({ className }: { className?: string }) {
  return (
    <img
      src="/brand/emblem.png"
      alt=""
      width={72}
      height={48}
      decoding="async"
      className={cn(
        "shrink-0 h-9 w-auto sm:h-11 md:h-12 object-contain select-none",
        className
      )}
    />
  );
}

export default function BrandLogo({
  showText = true,
  className,
  emblemClassName,
}: BrandLogoProps) {
  return (
    <div className={cn("flex items-center gap-2 sm:gap-2.5 min-w-0", className)}>
      <BrandEmblem className={emblemClassName} />
      {showText && (
        <span className="text-base sm:text-xl md:text-2xl font-extrabold tracking-tight leading-none whitespace-nowrap">
          <span className="text-brand-600">Easy</span>
          <span className="text-accent-500">Dunya</span>
        </span>
      )}
    </div>
  );
}
