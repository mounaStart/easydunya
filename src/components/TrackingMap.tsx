import { useEffect } from "react";
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
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

export interface MapPickup extends LatLng {
  id: string;
  quartier: string;
  count: number;
  passengerNames?: string[];
}

interface Props {
  from?: LatLng & { label?: string };
  to?: LatLng & { label?: string };
  driver?: LatLng | null;
  pickups?: MapPickup[];
  selectedPickupId?: string | null;
  onPickupSelect?: (id: string) => void;
  height?: number | string;
  /** route = trajet complet ; pickups = quartiers des demandes uniquement */
  variant?: "route" | "pickups";
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

function pickupCountIcon(count: number, selected: boolean) {
  const bg = selected ? "#dc2626" : "#f97316";
  const safeCount = escapeHtml(String(count));
  const size = 26;
  return L.divIcon({
    className: "ed-track-marker",
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:${bg};color:#fff;border:2px solid #fff;
      box-shadow:0 2px 6px rgba(0,0,0,0.28);
      display:flex;align-items:center;justify-content:center;
      font-size:12px;font-weight:800;line-height:1;">${safeCount}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

/** Marqueur compact : nom du quartier seulement (carte des demandes). */
function quartierIcon(quartier: string, selected: boolean) {
  const bg = selected ? "#dc2626" : "#f97316";
  const safe = escapeHtml(quartier);
  const short = quartier.length > 14 ? `${quartier.slice(0, 13)}…` : quartier;
  const safeShort = escapeHtml(short);
  return L.divIcon({
    className: "ed-track-marker",
    html: `<div style="
      max-width:88px;padding:3px 7px;border-radius:10px;
      background:${bg};color:#fff;border:2px solid #fff;
      box-shadow:0 2px 6px rgba(0,0,0,0.25);
      font-size:10px;font-weight:700;line-height:1.2;text-align:center;
      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"
      title="${safe}">${safeShort}</div>`,
    iconSize: [88, 22],
    iconAnchor: [44, 11],
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

function FitBounds({
  points,
  pickupsOnly,
}: {
  points: LatLng[];
  pickupsOnly?: boolean;
}) {
  const map = useMap();
  useEffect(() => {
    const valid = points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
    if (valid.length === 0) return;
    if (valid.length === 1) {
      map.setView([valid[0].lat, valid[0].lng], pickupsOnly ? 15 : 12);
    } else {
      map.fitBounds(
        L.latLngBounds(valid.map((p) => [p.lat, p.lng] as [number, number])),
        { padding: [32, 32], maxZoom: pickupsOnly ? 16 : 14 }
      );
    }
    setTimeout(() => map.invalidateSize(), 150);
  }, [points, map, pickupsOnly]);
  return null;
}

export default function TrackingMap({
  from,
  to,
  driver,
  pickups = [],
  selectedPickupId = null,
  onPickupSelect,
  height = 320,
  variant = "route",
}: Props) {
  const pickupsOnly = variant === "pickups";
  const showRoute = !pickupsOnly && from && to;

  const fitPoints: LatLng[] = pickupsOnly
    ? [
        ...pickups.map((p) => ({ lat: p.lat, lng: p.lng })),
        ...(driver ? [driver] : []),
      ]
    : [
        ...(from ? [{ lat: from.lat, lng: from.lng }] : []),
        ...(to ? [{ lat: to.lat, lng: to.lng }] : []),
        ...pickups.map((p) => ({ lat: p.lat, lng: p.lng })),
        ...(driver ? [driver] : []),
      ];

  const center: [number, number] =
    pickups.length > 0
      ? [pickups[0].lat, pickups[0].lng]
      : from
        ? [from.lat, from.lng]
        : [18.08, -15.98];

  return (
    <div className="rounded-3xl overflow-hidden shadow-soft border border-slate-100">
      <MapContainer
        center={center}
        zoom={pickupsOnly ? 14 : 6}
        scrollWheelZoom={false}
        style={{ height, width: "100%" }}
      >
        <FitBounds points={fitPoints} pickupsOnly={pickupsOnly} />
        <TileLayer
          attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {showRoute && from && to && (
          <>
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
          </>
        )}

        {pickups.map((p) => (
          <Marker
            key={p.id}
            position={[p.lat, p.lng]}
            icon={
              pickupsOnly
                ? quartierIcon(p.quartier, selectedPickupId === p.id)
                : pickupCountIcon(p.count, selectedPickupId === p.id)
            }
            eventHandlers={{
              click: () => onPickupSelect?.(p.id),
            }}
          >
            <Tooltip direction="top" offset={[0, pickupsOnly ? -12 : -14]} opacity={0.95}>
              <span className="font-semibold">
                {pickupsOnly ? p.quartier : `${p.quartier} · ${p.count}`}
              </span>
            </Tooltip>
            <Popup>
              <div className="text-sm leading-snug min-w-[120px]">
                <div className="font-bold text-ink">{p.quartier}</div>
                {p.passengerNames?.map((name) => (
                  <div key={name} className="text-slate-600 mt-0.5">
                    · {name}
                  </div>
                ))}
              </div>
            </Popup>
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
