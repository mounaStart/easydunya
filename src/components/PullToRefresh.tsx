import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { isNativePlatform } from "../lib/nativePush";

const PULL_THRESHOLD = 88;
const MAX_PULL = 100;
const PULL_ARM_DISTANCE = 36;
const PULL_ACTIVATION = 20;
/** Délai après un scroll avant d'autoriser le tirer-pour-actualiser. */
const SCROLL_SETTLE_MS = 650;
const TOP_EPSILON = 2;
const PULL_RESISTANCE = 0.5;
const REFRESH_TIMEOUT_MS = 12_000;
const MIN_INDICATOR_MS = 400;

function shouldIgnorePullTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      ".leaflet-container, .leaflet-pane, .gm-style, [data-no-ptr], input, select, textarea, button, a"
    )
  );
}

function scrollTop(): number {
  return window.scrollY || document.documentElement.scrollTop || 0;
}

function isAtTop(): boolean {
  return scrollTop() <= TOP_EPSILON;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error("refresh timeout")), ms);
    }),
  ]);
}

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
  /** Désactivé sur certaines sections (ex. chauffeur) où le geste perturbe le scroll. */
  enabled?: boolean;
}

export default function PullToRefresh({
  onRefresh,
  children,
  enabled = true,
}: PullToRefreshProps) {
  const { t } = useTranslation();
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const startScrollTop = useRef(0);
  const tracking = useRef(false);
  const pulling = useRef(false);
  const pullRef = useRef(0);
  const refreshingRef = useRef(false);
  const lastScrollAt = useRef(0);
  const refreshStartedAt = useRef(0);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    if (!isNativePlatform() || !enabled) return;

    const markScroll = () => {
      lastScrollAt.current = Date.now();
    };

    window.addEventListener("scroll", markScroll, { passive: true });
    document.addEventListener("scroll", markScroll, { passive: true, capture: true });

    const resetPull = () => {
      tracking.current = false;
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
      tracking.current = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!tracking.current || refreshingRef.current) return;
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

      if (dy < PULL_ARM_DISTANCE) return;

      if (!pulling.current) pulling.current = true;

      if (dy < PULL_ACTIVATION) return;

      e.preventDefault();
      const next = Math.min((dy - PULL_ACTIVATION) * PULL_RESISTANCE, MAX_PULL);
      pullRef.current = next;
      setPull(next);
    };

    const finishRefresh = async () => {
      refreshStartedAt.current = Date.now();
      setRefreshing(true);
      refreshingRef.current = true;
      setPull(0);
      try {
        await withTimeout(onRefreshRef.current(), REFRESH_TIMEOUT_MS);
      } catch {
        /* timeout ou réseau — on libère quand même l'UI */
      } finally {
        const elapsed = Date.now() - refreshStartedAt.current;
        const wait = Math.max(0, MIN_INDICATOR_MS - elapsed);
        window.setTimeout(() => {
          setRefreshing(false);
          refreshingRef.current = false;
          resetPull();
        }, wait);
      }
    };

    const onTouchEnd = async () => {
      if (!tracking.current) return;
      tracking.current = false;
      if (!pulling.current) return;
      pulling.current = false;
      const distance = pullRef.current;
      if (distance >= PULL_THRESHOLD && !refreshingRef.current && isAtTop()) {
        void finishRefresh();
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
      resetPull();
    };
  }, [enabled]);

  if (!isNativePlatform()) {
    return <>{children}</>;
  }

  const showPullHint = pull > 0 && !refreshing;
  const ready = pull >= PULL_THRESHOLD;

  return (
    <>
      {showPullHint && (
        <div
          aria-live="polite"
          className="pointer-events-none fixed left-0 right-0 z-[45] flex justify-center px-4"
          style={{
            top: "calc(var(--safe-area-inset-top, env(safe-area-inset-top, 0px)) + 0.5rem)",
          }}
        >
          <div className="flex items-center gap-2 rounded-full border border-brand-100 bg-white/95 px-3 py-1.5 shadow-sm text-xs">
            <span
              className="inline-block h-4 w-4 rounded-full border-2 border-brand-500 border-t-transparent"
              style={{
                transform: `rotate(${Math.min(pull / PULL_THRESHOLD, 1) * 280}deg)`,
              }}
            />
            <span className="font-medium text-slate-600">
              {ready ? t("common.releaseToRefresh") : t("common.pullToRefresh")}
            </span>
          </div>
        </div>
      )}

      {refreshing && (
        <div
          aria-live="polite"
          className="pointer-events-none fixed left-0 right-0 z-[45] flex justify-center px-4"
          style={{
            bottom: "calc(4.75rem + env(safe-area-inset-bottom, 0px))",
          }}
        >
          <div className="flex items-center gap-2 rounded-full border border-brand-100 bg-white px-4 py-2.5 shadow-lg">
            <span className="inline-block h-5 w-5 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
            <span className="text-sm font-semibold text-brand-700">
              {t("common.refreshing")}
            </span>
          </div>
        </div>
      )}

      {children}
    </>
  );
}
