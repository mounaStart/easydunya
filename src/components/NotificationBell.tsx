import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "../hooks/useAuth";
import { useNotifications } from "../hooks/useNotifications";
import { getPushState, subscribeToPush } from "../lib/push";
import { isNativePlatform } from "../lib/nativePush";
import { cn } from "../lib/utils";

type NotificationBellProps = {
  /** Affiche l’icône même sans connexion (maquette accueil passager). */
  alwaysVisible?: boolean;
};

export default function NotificationBell({ alwaysVisible = false }: NotificationBellProps) {
  const { user } = useAuth();
  const { items, unread, markRead, markAllRead } = useNotifications(user?.id);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Abonnement push automatique et transparent (sans bouton) :
  // si la permission est accordée mais l'appareil pas encore abonné, on abonne.
  const ensurePush = useCallback(async () => {
    if (!user) return;
    if (
      isNativePlatform() ||
      (typeof Notification !== "undefined" &&
        Notification.permission === "granted")
    ) {
      const st = await getPushState(user.id);
      if (st === "off") await subscribeToPush(user.id);
    }
  }, [user]);

  useEffect(() => {
    ensurePush();
  }, [ensurePush]);

  // Re-vérifie quand l'utilisateur revient sur l'app (après réglages Android)
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") ensurePush();
    }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [ensurePush]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (!user && !alwaysVisible) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => user && setOpen((o) => !o)}
        className="relative w-10 h-10 inline-flex items-center justify-center rounded-full text-slate-600 hover:bg-slate-50"
        aria-label="notifications"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {!user && alwaysVisible ? (
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white" />
        ) : unread > 0 ? (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>

      {user && open && (
        <>
          {/* Fond sombre sur mobile pour bien détacher le panneau */}
          <div
            className="fixed inset-0 z-40 bg-black/30 sm:hidden"
            onClick={() => setOpen(false)}
          />
          <div
            className="
              fixed inset-x-3 top-16 z-50 max-h-[75vh] overflow-y-auto
              rounded-2xl border border-slate-100 bg-white shadow-xl
              sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-80 sm:max-h-96
            "
          >
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 sticky top-0 bg-white">
            <span className="font-bold text-sm text-ink">Notifications</span>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs text-brand-600 font-semibold">
                Tout marquer lu
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">Aucune notification</p>
          ) : (
            <ul>
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => { if (!n.read) markRead(n.id); }}
                    className={cn(
                      "w-full text-left px-4 py-3 border-b border-slate-50 hover:bg-slate-50 transition",
                      !n.read && "bg-brand-50/50"
                    )}
                  >
                    <div className="font-semibold text-sm text-ink">{n.title}</div>
                    {n.body && <div className="text-xs text-slate-500 mt-0.5">{n.body}</div>}
                    <div className="text-[10px] text-slate-400 mt-1">
                      {new Date(n.created_at).toLocaleString()}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
          </div>
        </>
      )}
    </div>
  );
}
