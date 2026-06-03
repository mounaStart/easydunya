import { MapContainer, Marker, Polyline, TileLayer } from "react-leaflet";
import L from "leaflet";

function pin(color: string) {
  return L.divIcon({
    className: "ed-pin",
    html: `<div style="position:relative;width:34px;height:44px;">
      <svg width="34" height="44" viewBox="0 0 34 44" xmlns="http://www.w3.org/2000/svg">
        <path d="M17 0C7.6 0 0 7.6 0 17c0 12 17 27 17 27s17-15 17-27C34 7.6 26.4 0 17 0z" fill="${color}"/>
        <circle cx="17" cy="17" r="8" fill="#fff"/>
        <circle cx="17" cy="17" r="4" fill="${color}"/>
      </svg>
    </div>`,
    iconSize: [34, 44],
    iconAnchor: [17, 44],
  });
}

interface Props {
  from: [number, number];
  to: [number, number];
  driver?: [number, number] | null;
  height?: number | string;
}

export default function TrackingMap({ from, to, driver, height = 300 }: Props) {
  const dest = driver ?? to;
  const midLat = (from[0] + dest[0]) / 2;
  const midLng = (from[1] + dest[1]) / 2;

  return (
    <div className="rounded-3xl overflow-hidden border border-slate-100 shadow-soft">
      <MapContainer
        center={[midLat, midLng]}
        zoom={5}
        scrollWheelZoom={false}
        style={{ height, width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Polyline
          positions={[from, dest]}
          pathOptions={{
            color: "#1e88d6",
            weight: 4,
            dashArray: "10 12",
            opacity: 0.9,
          }}
        />
        <Marker position={from} icon={pin("#1e88d6")} />
        <Marker position={dest} icon={pin("#f97316")} />
      </MapContainer>
    </div>
  );
}
