import { createContext, useContext, type ReactNode } from "react";
import { useGoogleMapsScript } from "../lib/googleMapsLoader";

type GoogleMapsContextValue = ReturnType<typeof useGoogleMapsScript>;

const GoogleMapsContext = createContext<GoogleMapsContextValue | null>(null);

/** Charge Google Maps une seule fois pour toute l'app. */
export function GoogleMapsProvider({ children }: { children: ReactNode }) {
  const loader = useGoogleMapsScript();
  return <GoogleMapsContext.Provider value={loader}>{children}</GoogleMapsContext.Provider>;
}

export function useGoogleMapsReady(): GoogleMapsContextValue {
  const ctx = useContext(GoogleMapsContext);
  if (!ctx) {
    throw new Error("useGoogleMapsReady doit être utilisé dans GoogleMapsProvider");
  }
  return ctx;
}

export function mapHeightStyle(height: number | string): { width: string; height: string } {
  return {
    width: "100%",
    height: typeof height === "number" ? `${height}px` : height,
  };
}
