import { supabase } from "./supabase";
import {
  isNativePlatform,
  registerNativePush,
  getNativePushState,
  unregisterNativePush,
} from "./nativePush";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as
  | string
  | undefined;

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const output = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

function arrayBufferToBase64(buffer: ArrayBuffer | null): string {
  if (!buffer) return "";
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    typeof Notification !== "undefined"
  );
}

/** SW enregistré (évite `.ready` qui bloque indéfiniment sans PWA, ex. localhost). */
async function getPushRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;
  return (await navigator.serviceWorker.getRegistration()) ?? null;
}

async function waitForActivation(
  reg: ServiceWorkerRegistration,
  timeoutMs = 10_000
): Promise<boolean> {
  if (reg.active) return true;
  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => resolve(false), timeoutMs);
    const sw = reg.installing ?? reg.waiting;
    if (!sw) {
      window.clearTimeout(timeout);
      resolve(!!reg.active);
      return;
    }
    sw.addEventListener("statechange", () => {
      if (sw.state === "activated") {
        window.clearTimeout(timeout);
        resolve(true);
      }
    });
  });
}

/** En dev (PWA off), enregistre un SW minimal pour que Web Push fonctionne. */
async function ensurePushRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;

  const existing = await navigator.serviceWorker.getRegistration();
  if (existing?.active) return existing;

  if (import.meta.env.DEV) {
    try {
      const reg = await navigator.serviceWorker.register("/push-sw.js", {
        scope: "/",
        updateViaCache: "none",
      });
      const ready = await waitForActivation(reg);
      return ready ? reg : null;
    } catch (e) {
      console.warn("[push] échec enregistrement SW dev:", e);
      return null;
    }
  }

  // Production : SW Workbox enregistré par vite-plugin-pwa au chargement
  try {
    const reg = await navigator.serviceWorker.ready;
    return reg;
  } catch {
    return null;
  }
}

/**
 * Abonne l'appareil courant aux notifications Web Push et enregistre
 * l'abonnement côté Supabase. À appeler une fois l'utilisateur connecté,
 * idéalement après un geste utilisateur (permission accordée).
 */
export async function subscribeToPush(userId: string): Promise<boolean> {
  // Dans l'app native (APK Capacitor) : on utilise FCM natif
  // (notifications fiables « Easy Dunya » + logo, même app fermée).
  if (isNativePlatform()) {
    return registerNativePush(userId);
  }
  if (!isPushSupported()) {
    console.warn("[push] non supporté par ce navigateur");
    return false;
  }
  if (!VAPID_PUBLIC_KEY) {
    console.warn("[push] VITE_VAPID_PUBLIC_KEY manquant dans le build");
    return false;
  }
  if (Notification.permission !== "granted") {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") {
      console.warn("[push] permission refusée:", perm);
      return false;
    }
  }

  try {
    const reg = await ensurePushRegistration();
    if (!reg) {
      console.warn("[push] pas de service worker (PWA non active)");
      return false;
    }

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    const json = sub.toJSON();
    const p256dh = json.keys?.p256dh ?? arrayBufferToBase64(sub.getKey("p256dh"));
    const auth = json.keys?.auth ?? arrayBufferToBase64(sub.getKey("auth"));
    if (!sub.endpoint || !p256dh || !auth) {
      console.warn("[push] abonnement incomplet");
      return false;
    }

    const { error } = await supabase
      .from("push_subscriptions")
      .upsert(
        {
          user_id: userId,
          endpoint: sub.endpoint,
          p256dh,
          auth,
          user_agent: navigator.userAgent,
        },
        { onConflict: "endpoint" }
      );

    if (error) {
      console.warn("[push] échec enregistrement Supabase:", error.message);
      return false;
    }

    // Évite les doublons (Chrome navigateur + Samsung Internet + APK) :
    // on garde uniquement l'abonnement courant pour cet utilisateur.
    const { error: cleanupError } = await supabase
      .from("push_subscriptions")
      .delete()
      .eq("user_id", userId)
      .neq("endpoint", sub.endpoint);
    if (cleanupError) {
      console.warn("[push] nettoyage doublons échoué:", cleanupError.message);
    }

    console.info("[push] abonnement actif ✓");
    return true;
  } catch (e) {
    console.warn("[push] erreur subscribe:", e);
    return false;
  }
}

export type PushState = "unsupported" | "denied" | "off" | "on";

/**
 * État réel du push sur cet appareil.
 * Si userId est fourni, vérifie que l'abonnement en base appartient bien
 * à cet utilisateur (évite les notifs sur le mauvais compte après changement).
 */
export async function getPushState(userId?: string): Promise<PushState> {
  if (isNativePlatform()) return getNativePushState(userId);
  if (!isPushSupported() || !VAPID_PUBLIC_KEY) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  try {
    const reg = await getPushRegistration();
    if (!reg) return "off";
    const sub = await reg.pushManager.getSubscription();
    if (!sub?.endpoint) return "off";
    if (!userId) return "on";

    const { data } = await supabase
      .from("push_subscriptions")
      .select("user_id")
      .eq("endpoint", sub.endpoint)
      .maybeSingle();

    return data?.user_id === userId ? "on" : "off";
  } catch {
    return "off";
  }
}

/** Réassocie l'abonnement push au compte courant (après connexion). */
export async function rebindPushToUser(userId: string): Promise<boolean> {
  if (isNativePlatform()) return registerNativePush(userId);
  if (Notification.permission !== "granted") return false;
  return subscribeToPush(userId);
}

/** Désabonne l'appareil courant (déconnexion / refus). */
export async function unsubscribeFromPush(): Promise<void> {
  if (isNativePlatform()) {
    await unregisterNativePush();
    return;
  }
  if (!isPushSupported()) return;
  try {
    const reg = await getPushRegistration();
    if (!reg) return;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await supabase
        .from("push_subscriptions")
        .delete()
        .eq("endpoint", sub.endpoint);
      await sub.unsubscribe();
    }
  } catch {
    /* non bloquant */
  }
}
