import { cn } from "../lib/utils";

interface BrandLogoProps {
  showText?: boolean;
  showEmblem?: boolean;
  className?: string;
  emblemClassName?: string;
  textClassName?: string;
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
          <span className="text-[#1565c0]">Easy</span>
          <span className="text-[#f97316]">Dunya</span>
        </span>
      )}
    </div>
  );
}
