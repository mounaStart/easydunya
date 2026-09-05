import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { GoogleMap, MarkerF, PolylineF } from "@react-google-maps/api";
import { BRAND_BLUE, BRAND_ORANGE } from "../lib/brandColors";
import {
  googleCircleIcon,
  googleCountMarker,
  googleDriverMarker,
  googleTripArrivalIcon,
  googleTripDepartureIcon,
} from "../lib/googleMapMarkers";
import {
  fetchDrivingRouteWithStatus,
  truncateRouteBothEnds,
  type RouteFetchStatus,
  type RoutePoint,
} from "../lib/routing";
import {
  fitMapToPoints,
  googleMapsKeyMissing,
  useGoogleMapAuthGuard,
  watchMapUserInteraction,
} from "../hooks/useEdGoogleMapsLoader";
import { useGoogleMapsReady, mapHeightStyle } from "./GoogleMapsProvider";

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
  variant?: "route" | "pickups";
}

const FALLBACK_LINE = {
  strokeColor: "#f59e0b",
  strokeWeight: 3,
  strokeOpacity: 0.85,
  geodesic: true,
  icons: [
    {
      icon: {
        path: "M 0,-1 0,1",
        strokeOpacity: 1,
        scale: 3,
      },
      offset: "0",
      repeat: "16px",
    },
  ],
};

const GOOGLE_LINE = {
  strokeColor: BRAND_BLUE,
  strokeWeight: 5,
  strokeOpacity: 0.9,
  geodesic: true,
};

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
  const { t } = useTranslation();
  const pickupsOnly = variant === "pickups";
  const showRoute = !pickupsOnly && from && to;
  const { isLoaded, loadError } = useGoogleMapsReady();
  const mapWrapRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const userMovedMapRef = useRef(false);
  const routeFitDoneRef = useRef(false);
  const unwatchMapRef = useRef<(() => void) | null>(null);
  const authError = useGoogleMapAuthGuard(mapWrapRef);
  const [routePath, setRoutePath] = useState<RoutePoint[]>([]);
  const [routeStatus, setRouteStatus] = useState<RouteFetchStatus>("loading");
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (!showRoute || !from || !to) {
      setRoutePath([]);
      setRouteStatus("loading");
      return;
    }
    let cancelled = false;
    setRouteStatus("loading");
    void fetchDrivingRouteWithStatus(from, to, 4).then((result) => {
      if (cancelled) return;
      setRouteStatus(result.status);
      setRoutePath(result.route?.geometry ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [showRoute, from?.lat, from?.lng, to?.lat, to?.lng]);

  const hasGoogleRoute = routePath.length >= 2;
  const isRouteFallback = routeStatus === "fallback";

  /** Points fixes pour le cadrage initial (sans le chauffeur qui bouge). */
  const staticFitPoints = useMemo(() => {
    if (pickupsOnly) {
      return pickups.map((p) => ({ lat: p.lat, lng: p.lng }));
    }
    return [
      ...(from ? [{ lat: from.lat, lng: from.lng }] : []),
      ...(to ? [{ lat: to.lat, lng: to.lng }] : []),
      ...pickups.map((p) => ({ lat: p.lat, lng: p.lng })),
    ];
  }, [pickupsOnly, pickups, from, to]);

  const fallbackCenter = useMemo(() => {
    if (pickups.length > 0) return { lat: pickups[0].lat, lng: pickups[0].lng };
    if (from) return { lat: from.lat, lng: from.lng };
    if (to) return { lat: to.lat, lng: to.lng };
    return { lat: 18.08, lng: -15.98 };
  }, [pickups, from, to]);

  const truncated = useMemo(() => {
    if (!from || !to) {
      return null;
    }
    if (hasGoogleRoute) {
      return truncateRouteBothEnds(routePath, from, to);
    }
    if (isRouteFallback) {
      return {
        fromPoint: { lat: from.lat, lng: from.lng },
        toPoint: { lat: to.lat, lng: to.lng },
        path: [
          { lat: from.lat, lng: from.lng },
          { lat: to.lat, lng: to.lng },
        ],
      };
    }
    return null;
  }, [hasGoogleRoute, isRouteFallback, routePath, from, to]);

  const routeLine = truncated?.path ?? [];

  const markerFrom = truncated?.fromPoint ?? from;
  const markerTo = truncated?.toPoint ?? to;

  const applyInitialFit = useCallback(
    (m: google.maps.Map) => {
      const maxZoom = pickupsOnly ? 16 : 14;
      if (staticFitPoints.length > 0) {
        fitMapToPoints(m, staticFitPoints, 48, maxZoom);
        return;
      }
      m.setCenter(fallbackCenter);
      m.setZoom(pickupsOnly ? 14 : 6);
    },
    [staticFitPoints, fallbackCenter, pickupsOnly]
  );

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

  const onMapLoad = useCallback(
    (m: google.maps.Map) => {
      mapRef.current = m;
      userMovedMapRef.current = false;
      routeFitDoneRef.current = false;
      unwatchMapRef.current?.();
      unwatchMapRef.current = watchMapUserInteraction(m, () => {
        userMovedMapRef.current = true;
      });
      setMapReady(true);
      applyInitialFit(m);
    },
    [applyInitialFit]
  );

  const onMapUnmount = useCallback(() => {
    unwatchMapRef.current?.();
    unwatchMapRef.current = null;
    mapRef.current = null;
    userMovedMapRef.current = false;
    routeFitDoneRef.current = false;
    setMapReady(false);
  }, []);

  /** Recadrer une seule fois quand l'itinéraire Google arrive, si l'utilisateur n'a pas zoomé. */
  useEffect(() => {
    if (
      !mapReady ||
      userMovedMapRef.current ||
      routeFitDoneRef.current ||
      !hasGoogleRoute
    ) {
      return;
    }
    const m = mapRef.current;
    if (!m) return;
    routeFitDoneRef.current = true;
    fitMapToPoints(m, routeLine, 48, pickupsOnly ? 16 : 14);
  }, [mapReady, hasGoogleRoute, routeLine, pickupsOnly]);

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
        className="rounded-3xl overflow-hidden shadow-soft border border-slate-100 flex items-center justify-center bg-slate-100 text-xs text-slate-500"
        style={{ height }}
      >
        Chargement de la carte…
      </div>
    );
  }

  const driverMarker = mapReady ? googleDriverMarker() : null;

  return (
    <div className="relative rounded-3xl overflow-hidden shadow-soft border border-slate-100" data-no-ptr>
      {showRoute && routeStatus === "loading" && (
        <div className="pointer-events-none absolute z-[1000] top-2 left-2 right-2 bg-white/95 backdrop-blur rounded-xl px-3 py-1.5 text-[11px] text-slate-600 border border-slate-100 shadow-sm">
          {t("trip.routeLoading")}
        </div>
      )}
      {showRoute && isRouteFallback && (
        <div className="pointer-events-none absolute z-[1000] top-2 left-2 right-2 bg-amber-50 backdrop-blur rounded-xl px-3 py-2 text-[11px] text-amber-900 border border-amber-200 shadow-sm">
          <div className="font-semibold">{t("trip.routeFallbackTitle")}</div>
          <p className="mt-0.5 leading-snug">{t("trip.routeFallbackHint")}</p>
        </div>
      )}
      <div ref={mapWrapRef} style={containerStyle}>
        <GoogleMap
          mapContainerStyle={containerStyle}
          onLoad={onMapLoad}
          onUnmount={onMapUnmount}
          options={mapOptions}
        >
          {mapReady && showRoute && routeLine.length >= 2 && (
            <PolylineF
              path={routeLine}
              options={hasGoogleRoute ? GOOGLE_LINE : FALLBACK_LINE}
            />
          )}

          {mapReady && showRoute && markerFrom && (
            <MarkerF
              position={markerFrom}
              title={from.label ?? "Départ"}
              icon={googleTripDepartureIcon()}
              zIndex={900}
            />
          )}

          {mapReady && showRoute && markerTo && (
            <MarkerF
              position={markerTo}
              title={to.label ?? "Arrivée"}
              icon={googleTripArrivalIcon()}
              zIndex={900}
            />
          )}

          {mapReady &&
            pickups.map((p) => {
              const selected = selectedPickupId === p.id;
              const short =
                p.quartier.length > 14 ? `${p.quartier.slice(0, 13)}…` : p.quartier;
              if (pickupsOnly) {
                return (
                  <MarkerF
                    key={p.id}
                    position={{ lat: p.lat, lng: p.lng }}
                    title={p.quartier}
                    icon={googleCircleIcon(selected ? "#dc2626" : BRAND_ORANGE, 16)}
                    label={{
                      text: short,
                      color: "#ffffff",
                      fontSize: "10px",
                      fontWeight: "700",
                    }}
                    zIndex={selected ? 950 : 800}
                    onClick={() => onPickupSelect?.(p.id)}
                  />
                );
              }
              const { icon, label } = googleCountMarker(p.count, BRAND_ORANGE, 14, selected);
              return (
                <MarkerF
                  key={p.id}
                  position={{ lat: p.lat, lng: p.lng }}
                  title={p.quartier}
                  icon={icon}
                  label={label}
                  zIndex={selected ? 950 : 800}
                  onClick={() => onPickupSelect?.(p.id)}
                />
              );
            })}

          {mapReady && driver && driverMarker && (
            <MarkerF
              position={driver}
              title="Chauffeur"
              icon={driverMarker.icon}
              label={driverMarker.label}
              zIndex={1000}
            />
          )}
        </GoogleMap>
      </div>
    </div>
  );
}
