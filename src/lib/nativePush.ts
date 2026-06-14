import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { supabase } from "./supabase";
import type { PushState } from "./push";

/** Vrai uniquement dans l'app native (APK Capacitor), pas dans le navigateur. */
export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

let listenersBound = false;
let currentUserId: string | null = null;

async function saveToken(userId: string, token: string): Promise<void> {
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
    return;
  }
  // Évite les doublons : un seul appareil actif par utilisateur.
  const { error: cleanupError } = await supabase
    .from("device_tokens")
    .delete()
    .eq("user_id", userId)
    .neq("token", token);
  if (cleanupError) {
    console.warn("[fcm] nettoyage doublons échoué:", cleanupError.message);
  }
  console.info("[fcm] token enregistré ✓");
}

function bindListeners(): void {
  if (listenersBound) return;
  listenersBound = true;

  PushNotifications.addListener("registration", (token) => {
    if (currentUserId) {
      saveToken(currentUserId, token.value).catch(() => {});
    }
  });

  PushNotifications.addListener("registrationError", (err) => {
    console.warn("[fcm] erreur d'enregistrement:", JSON.stringify(err));
  });
}

/** Enregistre l'appareil natif au FCM et sauvegarde le token pour cet utilisateur. */
export async function registerNativePush(userId: string): Promise<boolean> {
  if (!isNativePlatform()) return false;
  currentUserId = userId;
  try {
    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === "prompt" || perm.receive === "prompt-with-rationale") {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== "granted") {
      console.warn("[fcm] permission refusée:", perm.receive);
      return false;
    }
    bindListeners();
    await PushNotifications.register();
    return true;
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
    if (!userId) return "on";
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
      await supabase
        .from("device_tokens")
        .delete()
        .eq("user_id", currentUserId);
    }
    currentUserId = null;
    await PushNotifications.removeAllListeners();
    listenersBound = false;
  } catch {
    /* non bloquant */
  }
}
