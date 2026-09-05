import { BRAND_BLUE } from "./brandColors";

/** Marqueurs natifs Google Maps (Symbol + SVG sur Marker). */

function requireMaps(): typeof google.maps {
  const maps = (window as Window & { google?: { maps: typeof google.maps } }).google?.maps;
  if (!maps) {
    throw new Error("Google Maps API not loaded");
  }
  return maps;
}

function svgMapIcon(svg: string, size: number): google.maps.Icon {
  const maps = requireMaps();
  const half = size / 2;
  return {
    url: `data:image/svg+xml,${encodeURIComponent(svg)}`,
    scaledSize: new maps.Size(size, size),
    anchor: new maps.Point(half, half),
  };
}

/** Cercle natif Google Maps. */
export function googleCircleIcon(
  fillColor: string,
  scale = 14,
  strokeColor = "#ffffff"
): google.maps.Symbol {
  const maps = requireMaps();
  return {
    path: maps.SymbolPath.CIRCLE,
    fillColor,
    fillOpacity: 1,
    strokeColor,
    strokeWeight: 3,
    scale,
  };
}

/** Départ : pastille verte pleine. */
export function googleTripDepartureIcon(): google.maps.Icon {
  return svgMapIcon(
    `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28">
      <circle cx="14" cy="14" r="11" fill="#22c55e" stroke="#ffffff" stroke-width="3"/>
    </svg>`,
    28
  );
}

/** Arrivée : pastille rouge avec point blanc au centre. */
export function googleTripArrivalIcon(): google.maps.Icon {
  return svgMapIcon(
    `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28">
      <circle cx="14" cy="14" r="11" fill="#ef4444" stroke="#ffffff" stroke-width="3"/>
      <circle cx="14" cy="14" r="4" fill="#ffffff"/>
    </svg>`,
    28
  );
}

/** Pastille avec chiffre (label Google natif). */
export function googleCountMarker(
  count: number,
  fillColor: string,
  scale = 14,
  selected = false
): { icon: google.maps.Symbol; label: google.maps.MarkerLabel } {
  return {
    icon: googleCircleIcon(selected ? "#dc2626" : fillColor, scale, selected ? "#dc2626" : "#ffffff"),
    label: {
      text: count > 0 ? String(count) : "•",
      color: "#ffffff",
      fontSize: "12px",
      fontWeight: "700",
    },
  };
}

/** Chauffeur : cercle bleu + voiture (position GPS en direct). */
export function googleDriverMarker(): { icon: google.maps.Symbol; label: google.maps.MarkerLabel } {
  return {
    icon: googleCircleIcon(BRAND_BLUE, 20, "#ffffff"),
    label: {
      text: "🚗",
      fontSize: "18px",
    },
  };
}
