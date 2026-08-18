import { supabase } from "./supabase";
import {
  isNativePlatform,
  registerNativePush,
  getNativePushState,
  unregisterNativePush,
} from "./nativePush";

function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

async function getPushRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;
  return (await navigator.serviceWorker.getRegistration()) ?? null;
}

/**
 * Abonne l'appareil aux notifications push.
 * Web Push (navigateur) désactivé — barre téléphone via APK FCM uniquement.
 */
export async function subscribeToPush(userId: string): Promise<boolean> {
  if (isNativePlatform()) {
    return registerNativePush(userId);
  }
  return false;
}

export type PushState = "unsupported" | "denied" | "off" | "on";

/** État du push natif (APK). Sur le web : toujours unsupported. */
export async function getPushState(userId?: string): Promise<PushState> {
  if (!isNativePlatform()) return "unsupported";
  return getNativePushState(userId);
}

/** Réassocie le push natif au compte courant (après connexion). */
export async function rebindPushToUser(userId: string): Promise<boolean> {
  if (!isNativePlatform()) return false;
  return registerNativePush(userId);
}

/** Désabonne l'appareil (déconnexion). Nettoie aussi d'éventuels restes Web Push. */
export async function unsubscribeFromPush(): Promise<void> {
  if (isNativePlatform()) {
    await unregisterNativePush();
    return;
  }
  if (!isPushSupported()) return;
  try {
    const reg = await getPushRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub?.endpoint) {
      await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      await sub.unsubscribe();
    }
  } catch {
    /* non bloquant */
  }
}
