import { useEffect, useState, type RefObject } from "react";
import {
  ensureGoogleMapsLoaded,
  getGoogleMapsApiKey,
  useGoogleMapsScript,
} from "../lib/googleMapsLoader";

/** Pastille avec chiffre (demandes passagers). */
export function countMarkerIcon(count: number, selected: boolean): google.maps.Symbol {
  void count;
  return {
    path: google.maps.SymbolPath.CIRCLE,
    fillColor: selected ? "#dc2626" : "#F97316",
    fillOpacity: 1,
    strokeColor: "#ffffff",
    strokeWeight: 2,
    scale: 14,
  };
}

/** Icône cercle (marqueur départ / arrivée). */
export function circleMarkerIcon(color: string, scale = 10): google.maps.Symbol {
  return {
    path: google.maps.SymbolPath.CIRCLE,
    fillColor: color,
    fillOpacity: 1,
    strokeColor: "#ffffff",
    strokeWeight: 3,
    scale,
  };
}

export function googleMapsKeyMissing(): boolean {
  return !getGoogleMapsApiKey();
}

export function fitMapToPoints(
  map: google.maps.Map,
  points: Array<{ lat: number; lng: number }>,
  padding = 48,
  maxZoom?: number
) {
  const valid = points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  if (valid.length === 0) return;
  if (valid.length === 1) {
    map.setCenter(valid[0]);
    map.setZoom(maxZoom ?? 12);
    return;
  }
  const bounds = new google.maps.LatLngBounds();
  valid.forEach((p) => bounds.extend(p));
  map.fitBounds(bounds, padding);
  if (maxZoom != null) {
    google.maps.event.addListenerOnce(map, "idle", () => {
      if ((map.getZoom() ?? 0) > maxZoom) map.setZoom(maxZoom);
    });
  }
}

/** Détecte quand l'utilisateur déplace ou zoome la carte (ignore le cadrage programmé). */
export function watchMapUserInteraction(
  map: google.maps.Map,
  onUserMoved: () => void
): () => void {
  let ignoreZoom = true;
  const dragListener = map.addListener("dragstart", onUserMoved);
  google.maps.event.addListenerOnce(map, "idle", () => {
    ignoreZoom = false;
  });
  const zoomListener = map.addListener("zoom_changed", () => {
    if (!ignoreZoom) onUserMoved();
  });
  return () => {
    dragListener.remove();
    zoomListener.remove();
  };
}

/** @deprecated Utiliser useGoogleMapsScript via GoogleMapsProvider */
export function useEdGoogleMapsLoader() {
  return useGoogleMapsScript();
}

/** Détecte l'overlay d'erreur Google (gm-err) sans démonter la carte (évite removeChild). */
export function useGoogleMapAuthGuard(containerRef: RefObject<HTMLDivElement | null>) {
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let timer: number | undefined;

    const check = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const text = el.querySelector(".gm-err-message")?.textContent?.trim() ?? null;
        setAuthError((prev) => (prev === text ? prev : text));
      }, 120);
    };

    check();
    const observer = new MutationObserver(check);
    observer.observe(el, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [containerRef]);

  return authError;
}

export { ensureGoogleMapsLoaded, useGoogleMapsScript };
