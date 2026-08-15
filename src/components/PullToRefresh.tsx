import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { isNativePlatform } from "../lib/nativePush";

const PULL_THRESHOLD = 58;
const MAX_PULL = 88;
const PULL_ACTIVATION = 8;
/** Délai après un scroll avant d'autoriser le tirer-pour-actualiser (évite l'actualisation en remontant en haut). */
const SCROLL_SETTLE_MS = 200;
const TOP_EPSILON = 2;
const PULL_RESISTANCE = 0.78;

function shouldIgnorePullTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest(".leaflet-container, .leaflet-pane, [data-no-ptr]"));
}

function scrollTop(): number {
  return window.scrollY || document.documentElement.scrollTop || 0;
}

function isAtTop(): boolean {
  return scrollTop() <= TOP_EPSILON;
}

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
}

export default function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const { t } = useTranslation();
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const startScrollTop = useRef(0);
  const pulling = useRef(false);
  const pullRef = useRef(0);
  const refreshingRef = useRef(false);
  const lastScrollAt = useRef(0);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    if (!isNativePlatform()) return;

    const markScroll = () => {
      lastScrollAt.current = Date.now();
    };

    window.addEventListener("scroll", markScroll, { passive: true });
    document.addEventListener("scroll", markScroll, { passive: true, capture: true });

    const resetPull = () => {
      pulling.current = false;
      pullRef.current = 0;
      setPull(0);
    };

    const canStartPull = () => {
      if (refreshingRef.current) return false;
      if (!isAtTop()) return false;
      if (Date.now() - lastScrollAt.current < SCROLL_SETTLE_MS) return false;
      return true;
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      if (shouldIgnorePullTarget(e.target)) return;
      startScrollTop.current = scrollTop();
      if (!canStartPull()) return;
      startY.current = e.touches[0].clientY;
      pulling.current = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!pulling.current || refreshingRef.current) return;
      if (shouldIgnorePullTarget(e.target)) {
        resetPull();
        return;
      }

      if (!isAtTop() || startScrollTop.current > TOP_EPSILON) {
        resetPull();
        return;
      }

      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0) {
        resetPull();
        return;
      }

      if (dy < PULL_ACTIVATION) return;

      e.preventDefault();
      const next = Math.min((dy - PULL_ACTIVATION) * PULL_RESISTANCE, MAX_PULL);
      pullRef.current = next;
      setPull(next);
    };

    const onTouchEnd = async () => {
      if (!pulling.current) return;
      pulling.current = false;
      const distance = pullRef.current;
      if (distance >= PULL_THRESHOLD && !refreshingRef.current && isAtTop()) {
        setRefreshing(true);
        refreshingRef.current = true;
        setPull(PULL_THRESHOLD * 0.5);
        try {
          await onRefreshRef.current();
        } finally {
          setRefreshing(false);
          refreshingRef.current = false;
          resetPull();
        }
      } else {
        resetPull();
      }
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd);
    document.addEventListener("touchcancel", onTouchEnd);

    return () => {
      window.removeEventListener("scroll", markScroll);
      document.removeEventListener("scroll", markScroll, { capture: true });
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", onTouchEnd);
    };
  }, []);

  if (!isNativePlatform()) {
    return <>{children}</>;
  }

  const visible = pull > 0 || refreshing;
  const ready = pull >= PULL_THRESHOLD;

  return (
    <>
      <div
        aria-live="polite"
        aria-hidden={!visible}
        className="pointer-events-none fixed left-0 right-0 z-[45] flex justify-center"
        style={{
          top: "calc(var(--safe-area-inset-top, env(safe-area-inset-top, 0px)) + 3.25rem)",
          opacity: visible ? 1 : 0,
          transition: "opacity 150ms ease",
        }}
      >
        <div className="flex items-center gap-2 rounded-full border border-slate-100 bg-white/95 px-4 py-2 shadow-md">
          <span
            className={`inline-block h-5 w-5 rounded-full border-2 border-brand-500 border-t-transparent ${
              refreshing ? "animate-spin" : ""
            }`}
            style={
              refreshing
                ? undefined
                : { transform: `rotate(${Math.min(pull / PULL_THRESHOLD, 1) * 280}deg)` }
            }
          />
          <span className="text-sm font-medium text-slate-600">
            {refreshing
              ? t("common.refreshing")
              : ready
                ? t("common.releaseToRefresh")
                : t("common.pullToRefresh")}
          </span>
        </div>
      </div>
      {children}
    </>
  );
}
