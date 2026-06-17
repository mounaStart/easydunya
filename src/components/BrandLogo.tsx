import { cn } from "../lib/utils";

interface BrandLogoProps {
  showText?: boolean;
  className?: string;
  emblemClassName?: string;
}

function BrandEmblem({ className }: { className?: string }) {
  return (
    <img
      src="/brand/emblem.png"
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
  className,
  emblemClassName,
}: BrandLogoProps) {
  return (
    <div className={cn("flex items-center gap-1.5 sm:gap-2.5 min-w-0 max-w-full", className)}>
      <BrandEmblem className={emblemClassName} />
      {showText && (
        <span className="text-sm sm:text-xl md:text-2xl font-extrabold tracking-tight leading-none truncate">
          <span className="text-brand-600">Easy</span>
          <span className="text-accent-500">Dunya</span>
        </span>
      )}
    </div>
  );
}
