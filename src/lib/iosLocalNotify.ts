import { registerPlugin } from "@capacitor/core";
import { isIosApp } from "./nativePush";

interface EasyDunyaNotifyPlugin {
  checkPermission(): Promise<{ status: string }>;
  requestPermission(): Promise<{ status: string }>;
  show(options: { title?: string; body?: string }): Promise<{ ok?: boolean }>;
}

const EasyDunyaNotify = registerPlugin<EasyDunyaNotifyPlugin>("EasyDunyaNotify");

type NotifyStatus = "granted" | "denied" | "prompt";

let cachedStatus: NotifyStatus | null = null;
let cachedAt = 0;
let requestInFlight: Promise<boolean> | null = null;
let lastRequestAt = 0;

const CHECK_CACHE_MS = 30_000;
const REQUEST_COOLDOWN_MS = 60_000;

function asState(status: NotifyStatus): "denied" | "off" | "on" {
  if (status === "granted") return "on";
  if (status === "denied") return "denied";
  return "off";
}

function parseStatus(raw: string): NotifyStatus {
  if (raw === "granted" || raw === "denied") return raw;
  return "prompt";
}

export async function getIosLocalNotifyState(): Promise<
  "unsupported" | "denied" | "off" | "on"
> {
  if (!isIosApp()) return "unsupported";
  if (cachedStatus && Date.now() - cachedAt < CHECK_CACHE_MS) {
    return asState(cachedStatus);
  }
  try {
    const { status } = await EasyDunyaNotify.checkPermission();
    cachedStatus = parseStatus(status);
    cachedAt = Date.now();
    return asState(cachedStatus);
  } catch {
    return "off";
  }
}

export async function requestIosLocalNotify(): Promise<boolean> {
  if (!isIosApp()) return false;
  if (cachedStatus === "granted") return true;
  if (cachedStatus === "denied") return false;
  if (requestInFlight) return requestInFlight;
  if (lastRequestAt > 0 && Date.now() - lastRequestAt < REQUEST_COOLDOWN_MS) {
    return false;
  }

  lastRequestAt = Date.now();
  requestInFlight = (async () => {
    try {
      const { status } = await EasyDunyaNotify.requestPermission();
      cachedStatus = parseStatus(status);
      cachedAt = Date.now();
      return cachedStatus === "granted";
    } catch {
      return false;
    } finally {
      requestInFlight = null;
    }
  })();
  return requestInFlight;
}

export async function showIosLocalNotification(
  title: string,
  body?: string | null
): Promise<void> {
  if (!isIosApp()) return;
  try {
    const state = await getIosLocalNotifyState();
    if (state !== "on") return;
    await EasyDunyaNotify.show({
      title: title || "Easy Dunya",
      body: body || "",
    });
  } catch {
    /* non bloquant */
  }
}
