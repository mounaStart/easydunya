import { useEffect, useMemo } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import type { CityTripCount } from "../lib/types";
import { useTranslation } from "react-i18next";

// Sans cette ligne, les icônes Leaflet ne s'affichent pas correctement avec Vite/Webpack.
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Centre approximatif de la Mauritanie
const CENTER: [number, number] = [20.5, -10];
// Cadre approximatif de la Mauritanie (sud-ouest → nord-est)
const MR_BOUNDS: [[number, number], [number, number]] = [
  [14.7, -17.1],
  [27.3, -4.8],
];

// Cadre automatiquement la carte sur les villes (ou la Mauritanie si aucune)
function FitToCities({ cities }: { cities: CityTripCount[] }) {
  const map = useMap();
  useEffect(() => {
    if (cities.length > 0) {
      const bounds = L.latLngBounds(
        cities.map((c) => [c.latitude, c.longitude] as [number, number])
      );
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 7 });
    } else {
      map.fitBounds(MR_BOUNDS, { padding: [20, 20] });
    }
    // Recalcule la taille après rendu (évite l'affichage partiel)
    setTimeout(() => map.invalidateSize(), 150);
  }, [cities, map]);
  return null;
}

interface Props {
  cities: CityTripCount[];
  selectedCityId?: string | null;
  onSelectCity?: (cityId: string | null) => void;
  height?: number | string;
  legend?: boolean;
}

export default function MapView({
  cities,
  selectedCityId,
  onSelectCity,
  height = 360,
  legend = false,
}: Props) {
  const { i18n, t } = useTranslation();
  const maxCount = useMemo(
    () => Math.max(1, ...cities.map((c) => c.upcoming_trips)),
    [cities]
  );

  return (
    <div className="relative rounded-3xl overflow-hidden shadow-soft border border-slate-100">
      {legend && (
        <div className="pointer-events-none absolute z-[1000] top-3 right-3 rtl:right-auto rtl:left-3 bg-white/95 backdrop-blur rounded-2xl shadow-card px-3 py-2 text-xs space-y-1 border border-slate-100">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ background: "#f97316" }} />
            {t("search.legendActive")}
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ background: "#94a3b8" }} />
            {t("search.legendNone")}
          </div>
        </div>
      )}
      <MapContainer
        center={CENTER}
        zoom={5}
        scrollWheelZoom={false}
        style={{ height, width: "100%" }}
      >
        <FitToCities cities={cities} />
        <TileLayer
          attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {cities.map((c) => {
          const count = c.upcoming_trips;
          const scale = 14 + Math.round((count / maxCount) * 18);
          const isSelected = selectedCityId === c.id;
          const color = count > 0 ? "#f97316" : "#94a3b8";
          const icon = L.divIcon({
            className: "ed-marker",
            html: `<div style="
              width:${scale}px;height:${scale}px;
              border-radius:50%;
              background:${color};
              border:3px solid ${isSelected ? "#1e88d6" : "white"};
              box-shadow:0 4px 10px rgba(30,136,214,0.35);
              display:flex;align-items:center;justify-content:center;
              color:white;font-weight:700;font-size:11px;
            ">${count || ""}</div>`,
            iconSize: [scale, scale],
            iconAnchor: [scale / 2, scale / 2],
          });
          const name = i18n.language === "ar" ? c.name_ar : c.name_fr;
          return (
            <Marker
              key={c.id}
              position={[c.latitude, c.longitude]}
              icon={icon}
              eventHandlers={{
                click: () => onSelectCity?.(isSelected ? null : c.id),
              }}
            >
              <Popup>
                <div className="text-sm">
                  <div className="font-semibold">{name}</div>
                  <div className="text-slate-500">
                    {count} {t("home.upcomingTrips").toLowerCase()}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
