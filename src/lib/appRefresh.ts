import { useEffect } from "react";

/** Événement global : tirer-pour-actualiser ou retour app visible. */
export const APP_REFRESH_EVENT = "easydunya:refresh";

export interface AppRefreshDetail {
  /** Remet la page d'accueil passager à l'état initial (formulaire + liste paginée). */
  resetHome?: boolean;
}

export function dispatchAppRefresh(detail: AppRefreshDetail = {}): void {
  window.dispatchEvent(new CustomEvent(APP_REFRESH_EVENT, { detail }));
}

/** Réagit à l'actualisation globale (voyages, réservations, notifications…). */
export function useAppRefresh(
  onRefresh: (detail?: AppRefreshDetail) => void | Promise<void>
): void {
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<AppRefreshDetail>).detail;
      void Promise.resolve(onRefresh(detail));
    };
    window.addEventListener(APP_REFRESH_EVENT, handler);
    return () => window.removeEventListener(APP_REFRESH_EVENT, handler);
  }, [onRefresh]);
}
