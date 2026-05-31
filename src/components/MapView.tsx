import { useMemo } from "react";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
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

interface Props {
  cities: CityTripCount[];
  selectedCityId?: string | null;
  onSelectCity?: (cityId: string | null) => void;
  height?: number | string;
}

export default function MapView({
  cities,
  selectedCityId,
  onSelectCity,
  height = 360,
}: Props) {
  const { i18n, t } = useTranslation();
  const maxCount = useMemo(
    () => Math.max(1, ...cities.map((c) => c.upcoming_trips)),
    [cities]
  );

  return (
    <div className="rounded-2xl overflow-hidden shadow-soft border border-slate-100">
      <MapContainer
        center={CENTER}
        zoom={5}
        scrollWheelZoom={false}
        style={{ height, width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {cities.map((c) => {
          const count = c.upcoming_trips;
          const scale = 14 + Math.round((count / maxCount) * 18);
          const isSelected = selectedCityId === c.id;
          const color = count > 0 ? "#0d9488" : "#94a3b8";
          const icon = L.divIcon({
            className: "ed-marker",
            html: `<div style="
              width:${scale}px;height:${scale}px;
              border-radius:50%;
              background:${color};
              border:3px solid ${isSelected ? "#f59e0b" : "white"};
              box-shadow:0 4px 10px rgba(15,118,110,0.35);
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
