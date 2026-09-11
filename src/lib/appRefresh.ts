import { useEffect } from "react";

/** Événement global : tirer-pour-actualiser ou retour app visible. */
export const APP_REFRESH_EVENT = "easydunya:refresh";

export function dispatchAppRefresh(): void {
  window.dispatchEvent(new CustomEvent(APP_REFRESH_EVENT));
}

/** Réagit à l'actualisation globale (voyages, réservations, notifications…). */
export function useAppRefresh(onRefresh: () => void | Promise<void>): void {
  useEffect(() => {
    const handler = () => {
      void Promise.resolve(onRefresh());
    };
    window.addEventListener(APP_REFRESH_EVENT, handler);
    return () => window.removeEventListener(APP_REFRESH_EVENT, handler);
  }, [onRefresh]);
}
