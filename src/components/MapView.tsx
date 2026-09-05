import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GoogleMap, InfoWindowF, MarkerF } from "@react-google-maps/api";
import type { CityTripCount } from "../lib/types";
import { useTranslation } from "react-i18next";
import { BRAND_ORANGE } from "../lib/brandColors";
import { googleCountMarker } from "../lib/googleMapMarkers";
import {
  fitMapToPoints,
  googleMapsKeyMissing,
  useGoogleMapAuthGuard,
  watchMapUserInteraction,
} from "../hooks/useEdGoogleMapsLoader";
import { useGoogleMapsReady, mapHeightStyle } from "./GoogleMapsProvider";

const MR_BOUNDS_SW = { lat: 14.7, lng: -17.1 };
const MR_BOUNDS_NE = { lat: 27.3, lng: -4.8 };

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
  const { isLoaded, loadError } = useGoogleMapsReady();
  const mapWrapRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const userMovedMapRef = useRef(false);
  const citiesFitDoneRef = useRef(false);
  const unwatchMapRef = useRef<(() => void) | null>(null);
  const authError = useGoogleMapAuthGuard(mapWrapRef);
  const [mapReady, setMapReady] = useState(false);
  const [infoCityId, setInfoCityId] = useState<string | null>(null);
  const containerStyle = useMemo(() => mapHeightStyle(height), [height]);

  const mapOptions = useMemo<google.maps.MapOptions>(
    () => ({
      disableDefaultUI: false,
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      gestureHandling: "cooperative",
    }),
    []
  );

  const maxCount = useMemo(
    () => Math.max(1, ...cities.map((c) => c.upcoming_trips)),
    [cities]
  );

  const cityPoints = useMemo(
    () => cities.map((c) => ({ lat: c.latitude, lng: c.longitude })),
    [cities]
  );

  const refit = useCallback(
    (m: google.maps.Map) => {
      if (cityPoints.length > 0) {
        fitMapToPoints(m, cityPoints, 40, 7);
      } else {
        m.fitBounds(
          new google.maps.LatLngBounds(MR_BOUNDS_SW, MR_BOUNDS_NE),
          24
        );
      }
    },
    [cityPoints]
  );

  const onMapLoad = useCallback(
    (m: google.maps.Map) => {
      mapRef.current = m;
      userMovedMapRef.current = false;
      citiesFitDoneRef.current = false;
      unwatchMapRef.current?.();
      unwatchMapRef.current = watchMapUserInteraction(m, () => {
        userMovedMapRef.current = true;
      });
      setMapReady(true);
      refit(m);
    },
    [refit]
  );

  const onMapUnmount = useCallback(() => {
    unwatchMapRef.current?.();
    unwatchMapRef.current = null;
    mapRef.current = null;
    userMovedMapRef.current = false;
    citiesFitDoneRef.current = false;
    setMapReady(false);
  }, []);

  useEffect(() => {
    if (!mapReady || userMovedMapRef.current || citiesFitDoneRef.current || !mapRef.current) {
      return;
    }
    if (cityPoints.length === 0) return;
    citiesFitDoneRef.current = true;
    refit(mapRef.current);
  }, [mapReady, cityPoints, refit]);

  if (googleMapsKeyMissing()) {
    return (
      <div
        className="rounded-3xl overflow-hidden shadow-soft border border-slate-100 flex items-center justify-center bg-slate-100 text-xs text-slate-600 p-4 text-center"
        style={{ height }}
      >
        Carte indisponible — clé Google Maps manquante (Netlify / build APK).
      </div>
    );
  }

  if (loadError || authError) {
    return (
      <div
        className="rounded-3xl overflow-hidden shadow-soft border border-slate-100 flex items-center justify-center bg-slate-100 text-xs text-slate-600 p-4 text-center"
        style={{ height }}
      >
        {authError ?? loadError?.message ?? "Carte Google Maps indisponible."}
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div
        className="relative rounded-3xl overflow-hidden shadow-soft border border-slate-100 flex items-center justify-center bg-slate-100 text-xs text-slate-500"
        style={{ height }}
      >
        Chargement de la carte…
      </div>
    );
  }

  return (
    <div className="relative rounded-3xl overflow-hidden shadow-soft border border-slate-100">
      {legend && (
        <div className="pointer-events-none absolute z-[1000] top-3 right-3 rtl:right-auto rtl:left-3 bg-white/95 backdrop-blur rounded-2xl shadow-card px-3 py-2 text-xs space-y-1 border border-slate-100">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ background: BRAND_ORANGE }} />
            {t("search.legendActive")}
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ background: "#94a3b8" }} />
            {t("search.legendNone")}
          </div>
        </div>
      )}
      <div ref={mapWrapRef} style={containerStyle}>
        <GoogleMap
          mapContainerStyle={containerStyle}
          onLoad={onMapLoad}
          onUnmount={onMapUnmount}
          options={mapOptions}
        >
          {mapReady &&
            cities.map((c) => {
              const count = c.upcoming_trips;
              const scale = 10 + Math.round((count / maxCount) * 10);
              const isSelected = selectedCityId === c.id;
              const color = count > 0 ? BRAND_ORANGE : "#94a3b8";
              const name = i18n.language === "ar" ? c.name_ar : c.name_fr;
              const position = { lat: c.latitude, lng: c.longitude };
              const { icon, label } = googleCountMarker(count, color, scale, isSelected);

              return (
                <MarkerF
                  key={c.id}
                  position={position}
                  title={name}
                  icon={icon}
                  label={label}
                  zIndex={isSelected ? 900 : count > 0 ? 800 : 700}
                  onClick={() => {
                    onSelectCity?.(isSelected ? null : c.id);
                    setInfoCityId(c.id);
                  }}
                />
              );
            })}

          {mapReady &&
            infoCityId &&
            (() => {
              const c = cities.find((x) => x.id === infoCityId);
              if (!c) return null;
              const name = i18n.language === "ar" ? c.name_ar : c.name_fr;
              return (
                <InfoWindowF
                  position={{ lat: c.latitude, lng: c.longitude }}
                  onCloseClick={() => setInfoCityId(null)}
                >
                  <div className="text-sm">
                    <div className="font-semibold">{name}</div>
                    <div className="text-slate-500">
                      {c.upcoming_trips} {t("home.upcomingTrips").toLowerCase()}
                    </div>
                  </div>
                </InfoWindowF>
              );
            })()}
        </GoogleMap>
      </div>
    </div>
  );
}
