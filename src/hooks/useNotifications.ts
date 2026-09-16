import { useCallback, useEffect, useRef, useState } from "react";
import { useAppRefresh } from "../lib/appRefresh";
import { supabase } from "../lib/supabase";
import { showIosLocalNotification } from "../lib/iosLocalNotify";
import type { AppNotification } from "../lib/types";

/** Types affichés dans la cloche in-app uniquement (push téléphone séparé). */
export const IN_APP_HIDDEN_NOTIFICATION_TYPES = new Set(["password_reset_success"]);

export function isInAppNotification(n: Pick<AppNotification, "type">): boolean {
  return !n.type || !IN_APP_HIDDEN_NOTIFICATION_TYPES.has(n.type);
}

export function useNotifications(userId: string | undefined) {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const seenIdsRef = useRef<Set<string> | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    const list =
      (data as AppNotification[] | null)?.filter(isInAppNotification) ?? [];
    if (seenIdsRef.current === null) {
      seenIdsRef.current = new Set(list.map((n) => n.id));
    } else {
      for (const n of list) {
        if (!seenIdsRef.current.has(n.id) && !n.read) {
          void showIosLocalNotification(n.title, n.body);
        }
        seenIdsRef.current.add(n.id);
      }
    }
    setItems(list);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    load();
    if (!userId) return;

    let realtimeOk = false;

    // Ajoute une notif reçue en direct sans attendre un rechargement complet
    function addIncoming(n: AppNotification) {
      if (!isInAppNotification(n)) return;
      if (!seenIdsRef.current) seenIdsRef.current = new Set();
      const isNew = !seenIdsRef.current.has(n.id);
      seenIdsRef.current.add(n.id);
      setItems((prev) =>
        prev.some((x) => x.id === n.id) ? prev : [n, ...prev].slice(0, 50)
      );
      if (isNew) void showIosLocalNotification(n.title, n.body);
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
    window.addEventListener("easydunya:refresh-notifications", onVisible);

    return () => {
      supabase.removeChannel(ch);
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("easydunya:refresh-notifications", onVisible);
    };
  }, [userId, load]);

  useAppRefresh(load);

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
