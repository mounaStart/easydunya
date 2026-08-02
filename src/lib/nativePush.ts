import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { PushNotifications } from "@capacitor/push-notifications";
import { supabase } from "./supabase";
import type { PushState } from "./push";

/** Vrai dans l'APK Capacitor (pas dans le navigateur). */
export function isNativePlatform(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

let listenersBound = false;
let currentUserId: string | null = null;
let pendingToken: string | null = null;

async function ensureLocalNotificationPermission(): Promise<boolean> {
  let perm = await LocalNotifications.checkPermissions();
  if (perm.display === "prompt" || perm.display === "prompt-with-rationale") {
    perm = await LocalNotifications.requestPermissions();
  }
  return perm.display === "granted";
}

/** Affiche une notification système quand l'APK est au premier plan (Android). */
export async function showNativeForegroundNotification(
  title: string,
  body?: string,
  tag?: string
): Promise<void> {
  if (!isNativePlatform()) return;
  try {
    if (!(await ensureLocalNotificationPermission())) return;
    const id =
      Math.abs(
        (tag ?? title + (body ?? ""))
          .split("")
          .reduce((a, c) => a + c.charCodeAt(0), 0)
      ) % 2147483646 || 1;
    await LocalNotifications.schedule({
      notifications: [
        {
          id,
          title: title || "Easy Dunya",
          body: body ?? "",
          channelId: "easydunya_default",
          smallIcon: "ic_stat_notify",
          largeIcon: "ic_notify_large",
          iconColor: "#F57C00",
        },
      ],
    });
  } catch (e) {
    console.warn("[fcm] notification locale (premier plan):", e);
  }
}

async function saveToken(userId: string, token: string): Promise<boolean> {
  const { error } = await supabase.from("device_tokens").upsert(
    {
      user_id: userId,
      token,
      platform: Capacitor.getPlatform(),
    },
    { onConflict: "token" }
  );
  if (error) {
    console.warn("[fcm] échec enregistrement token:", error.message);
    return false;
  }
  const { error: cleanupError } = await supabase
    .from("device_tokens")
    .delete()
    .eq("user_id", userId)
    .neq("token", token);
  if (cleanupError) {
    console.warn("[fcm] nettoyage doublons échoué:", cleanupError.message);
  }
  console.info("[fcm] token enregistré ✓");
  return true;
}

function bindListeners(): void {
  if (listenersBound) return;
  listenersBound = true;

  PushNotifications.addListener("registration", (ev) => {
    pendingToken = ev.value;
    console.info("[fcm] token reçu:", ev.value.slice(0, 20) + "…");
    if (currentUserId) {
      saveToken(currentUserId, ev.value).catch(() => {});
    }
  });

  PushNotifications.addListener("registrationError", (err) => {
    console.warn("[fcm] erreur d'enregistrement:", JSON.stringify(err));
  });

  PushNotifications.addListener("pushNotificationReceived", (n) => {
    console.info("[fcm] notif reçue (app ouverte):", n.title);
    showNativeForegroundNotification(
      n.title ?? "Easy Dunya",
      n.body ?? undefined,
      n.data?.tag as string | undefined
    ).catch(() => {});
  });
}

/** À appeler au démarrage de l'app (avant la connexion). */
export function initNativePush(): void {
  if (!isNativePlatform()) return;
  bindListeners();
}

/** Enregistre l'appareil natif au FCM et sauvegarde le token pour cet utilisateur. */
export async function registerNativePush(userId: string): Promise<boolean> {
  if (!isNativePlatform()) return false;
  currentUserId = userId;
  initNativePush();

  try {
    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === "prompt" || perm.receive === "prompt-with-rationale") {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== "granted") {
      console.warn("[fcm] permission refusée:", perm.receive);
      return false;
    }

    if (Capacitor.getPlatform() === "android") {
      const channel = {
        id: "easydunya_default",
        name: "Easy Dunya",
        description: "Réservations, confirmations et départs",
        importance: 5 as const,
        visibility: 1 as const,
        sound: "default",
        vibration: true,
      };
      await PushNotifications.createChannel(channel);
      await LocalNotifications.createChannel(channel);
    }

    await PushNotifications.register();

    if (pendingToken) {
      return saveToken(userId, pendingToken);
    }

    await new Promise((r) => setTimeout(r, 2500));
    if (pendingToken) {
      return saveToken(userId, pendingToken);
    }

    console.warn("[fcm] permission OK mais aucun token FCM reçu");
    return false;
  } catch (e) {
    console.warn("[fcm] erreur register:", e);
    return false;
  }
}

/** État du push natif pour cet utilisateur. */
export async function getNativePushState(userId?: string): Promise<PushState> {
  if (!isNativePlatform()) return "unsupported";
  try {
    const perm = await PushNotifications.checkPermissions();
    if (perm.receive === "denied") return "denied";
    if (perm.receive !== "granted") return "off";
    if (!userId) return pendingToken ? "on" : "off";
    const { data } = await supabase
      .from("device_tokens")
      .select("user_id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    return data ? "on" : "off";
  } catch {
    return "off";
  }
}

/** Supprime le token natif courant (déconnexion). */
export async function unregisterNativePush(): Promise<void> {
  if (!isNativePlatform()) return;
  try {
    if (currentUserId) {
      await supabase.from("device_tokens").delete().eq("user_id", currentUserId);
    }
    currentUserId = null;
    pendingToken = null;
    await PushNotifications.removeAllListeners();
    listenersBound = false;
  } catch {
    /* non bloquant */
  }
}
