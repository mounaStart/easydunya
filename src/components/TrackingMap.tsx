import { useEffect } from "react";
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import L from "leaflet";

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

export interface LatLng {
  lat: number;
  lng: number;
}

interface Props {
  from: LatLng & { label?: string };
  to: LatLng & { label?: string };
  driver?: LatLng | null;
  pickups?: (LatLng & { label?: string })[];
  height?: number | string;
}

function dot(color: string, ring = "white") {
  return L.divIcon({
    className: "ed-track-marker",
    html: `<div style="
      width:20px;height:20px;border-radius:50%;
      background:${color};border:3px solid ${ring};
      box-shadow:0 3px 8px rgba(0,0,0,0.35);"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

const carIcon = L.divIcon({
  className: "ed-track-marker",
  html: `<div style="
    width:34px;height:34px;border-radius:50%;
    background:#1e88d6;border:3px solid white;
    box-shadow:0 4px 10px rgba(30,136,214,0.5);
    display:flex;align-items:center;justify-content:center;font-size:18px;">🚗</div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

function FitBounds({ points }: { points: LatLng[] }) {
  const map = useMap();
  useEffect(() => {
    const valid = points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
    if (valid.length === 0) return;
    if (valid.length === 1) {
      map.setView([valid[0].lat, valid[0].lng], 12);
    } else {
      map.fitBounds(
        L.latLngBounds(valid.map((p) => [p.lat, p.lng] as [number, number])),
        { padding: [40, 40], maxZoom: 13 }
      );
    }
    setTimeout(() => map.invalidateSize(), 150);
  }, [points, map]);
  return null;
}

export default function TrackingMap({
  from,
  to,
  driver,
  pickups = [],
  height = 320,
}: Props) {
  const points: LatLng[] = [
    { lat: from.lat, lng: from.lng },
    { lat: to.lat, lng: to.lng },
    ...pickups.map((p) => ({ lat: p.lat, lng: p.lng })),
    ...(driver ? [driver] : []),
  ];

  return (
    <div className="rounded-3xl overflow-hidden shadow-soft border border-slate-100">
      <MapContainer
        center={[from.lat, from.lng]}
        zoom={6}
        scrollWheelZoom={false}
        style={{ height, width: "100%" }}
      >
        <FitBounds points={points} />
        <TileLayer
          attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <Polyline
          positions={[
            [from.lat, from.lng],
            [to.lat, to.lng],
          ]}
          pathOptions={{ color: "#1e88d6", weight: 3, dashArray: "6 8", opacity: 0.7 }}
        />

        <Marker position={[from.lat, from.lng]} icon={dot("#10b981")}>
          <Popup>{from.label ?? "Départ"}</Popup>
        </Marker>
        <Marker position={[to.lat, to.lng]} icon={dot("#ef4444")}>
          <Popup>{to.label ?? "Arrivée"}</Popup>
        </Marker>

        {pickups.map((p, i) => (
          <Marker key={i} position={[p.lat, p.lng]} icon={dot("#f97316")}>
            <Popup>{p.label ?? "Passager"}</Popup>
          </Marker>
        ))}

        {driver && (
          <Marker position={[driver.lat, driver.lng]} icon={carIcon}>
            <Popup>🚗</Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}
