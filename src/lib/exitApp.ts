import { App } from "@capacitor/app";
import { isNativePlatform } from "./nativePush";

/** Quitte l'application (APK) ou ferme l'onglet navigateur si possible. */
export async function exitApplication(): Promise<void> {
  if (isNativePlatform()) {
    await App.exitApp();
    return;
  }

  window.open("", "_self");
  window.close();

  document.body.innerHTML =
    '<div style="font-family:system-ui,sans-serif;padding:2rem;text-align:center;color:#334155">' +
    "<h1>Easy Dunya</h1>" +
    "<p>Vous devez accepter les Conditions Générales d'Utilisation pour utiliser l'application.</p>" +
    "<p><a href=\"/\">Revenir à l'application</a></p>" +
    "</div>";
}
