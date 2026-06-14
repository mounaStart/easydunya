import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { subscribeToPush } from "../lib/push";
import type { AppNotification } from "../lib/types";

// Vrai dès qu'un abonnement Web Push est actif : on évite alors d'afficher
// une 2ᵉ notification via l'API Notification (le service worker s'en charge).
let pushActive = false;

/** Demande (une fois) la permission d'afficher des notifications système. */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (typeof Notification === "undefined") return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  try {
    const res = await Notification.requestPermission();
    return res === "granted";
  } catch {
    return false;
  }
}

/** Affiche une notification système (téléphone/bureau) si autorisé. */
async function showSystemNotification(title: string, body?: string) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") {
    return;
  }
  const options: NotificationOptions = {
    body: body ?? undefined,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
  };
  try {
    // Via le service worker si dispo (meilleur support mobile/arrière-plan)
    const reg =
      "serviceWorker" in navigator
        ? await navigator.serviceWorker.getRegistration()
        : null;
    if (reg) {
      await reg.showNotification(title, options);
    } else {
      new Notification(title, options);
    }
  } catch {
    /* notification système non bloquante */
  }
}

export function useNotifications(userId: string | undefined) {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    setItems((data as AppNotification[] | null) ?? []);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    load();
    if (!userId) {
      pushActive = false;
      return;
    }
    // Réinitialise à chaque changement de compte sur cet appareil
    pushActive = false;
    subscribeToPush(userId)
      .then((ok) => {
        pushActive = ok;
        if (!ok) ensureNotificationPermission();
      })
      .catch(() => {
        ensureNotificationPermission();
      });

    let realtimeOk = false;

    // Ajoute une notif reçue en direct sans attendre un rechargement complet
    function addIncoming(n: AppNotification) {
      setItems((prev) =>
        prev.some((x) => x.id === n.id) ? prev : [n, ...prev].slice(0, 50)
      );
      if (!pushActive && n.title) showSystemNotification(n.title, n.body ?? undefined);
    }

    const ch = supabase
      .channel(`notif-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          const n = payload.new as AppNotification | null;
          if (n) addIncoming(n);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          const n = payload.new as AppNotification | null;
          if (n) setItems((prev) => prev.map((x) => (x.id === n.id ? n : x)));
        }
      )
      .subscribe((status) => {
        realtimeOk = status === "SUBSCRIBED";
      });

    // Repli : si le temps réel n'est pas actif (table hors publication), on
    // sonde régulièrement. Sinon, simple filet de sécurité plus espacé.
    const poll = setInterval(() => {
      if (!realtimeOk || document.visibilityState === "visible") load();
    }, realtimeOk ? 30000 : 8000);

    // Rafraîchit dès que l'utilisateur revient sur l'app
    function onVisible() {
      if (document.visibilityState === "visible") load();
    }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      supabase.removeChannel(ch);
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [userId, load]);

  const unread = items.filter((n) => !n.read).length;

  async function markRead(id: string) {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }

  async function markAllRead() {
    if (!userId) return;
    await supabase.from("notifications").update({ read: true }).eq("user_id", userId).eq("read", false);
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  return { items, loading, unread, refresh: load, markRead, markAllRead };
}

/** Envoie une notification à un utilisateur (via RPC SECURITY DEFINER). */
export async function sendNotification(
  userId: string,
  title: string,
  body?: string,
  type?: string,
  data?: Record<string, unknown>
) {
  await supabase.rpc("notify_user", {
    p_user: userId,
    p_title: title,
    p_body: body ?? null,
    p_type: type ?? null,
    p_data: data ?? null,
  });
}
