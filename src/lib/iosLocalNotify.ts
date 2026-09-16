import { registerPlugin } from "@capacitor/core";
import { isIosApp } from "./nativePush";

interface EasyDunyaNotifyPlugin {
  checkPermission(): Promise<{ status: string }>;
  requestPermission(): Promise<{ status: string }>;
  show(options: { title?: string; body?: string }): Promise<{ ok?: boolean }>;
}

const EasyDunyaNotify = registerPlugin<EasyDunyaNotifyPlugin>("EasyDunyaNotify");

export async function getIosLocalNotifyState(): Promise<
  "unsupported" | "denied" | "off" | "on"
> {
  if (!isIosApp()) return "unsupported";
  try {
    const { status } = await EasyDunyaNotify.checkPermission();
    if (status === "granted") return "on";
    if (status === "denied") return "denied";
    return "off";
  } catch {
    return "off";
  }
}

export async function requestIosLocalNotify(): Promise<boolean> {
  if (!isIosApp()) return false;
  try {
    const { status } = await EasyDunyaNotify.requestPermission();
    return status === "granted";
  } catch {
    return false;
  }
}

export async function showIosLocalNotification(
  title: string,
  body?: string | null
): Promise<void> {
  if (!isIosApp()) return;
  try {
    const { status } = await EasyDunyaNotify.checkPermission();
    if (status !== "granted") return;
    await EasyDunyaNotify.show({
      title: title || "Easy Dunya",
      body: body || "",
    });
  } catch {
    /* non bloquant */
  }
}
