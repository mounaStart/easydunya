// =====================================================================
// Edge Function: directions
// Proxy Google Directions API (distance routière identique à Google Maps).
//
// Secret requis : GOOGLE_MAPS_API_KEY
// Déployer : supabase functions deploy directions --project-ref prfmqfnaqtmyfyxqjeli
// =====================================================================

const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isValidCoord(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function isValidPoint(p: unknown): p is { lat: number; lng: number } {
  if (!p || typeof p !== "object") return false;
  const pt = p as { lat?: unknown; lng?: unknown };
  return isValidCoord(pt.lat) && isValidCoord(pt.lng);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  if (!GOOGLE_MAPS_API_KEY) {
    return json({ error: "GOOGLE_MAPS_API_KEY non configurée sur Supabase." }, 503);
  }

  let body: { from?: unknown; to?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Corps JSON invalide." }, 400);
  }

  if (!isValidPoint(body.from) || !isValidPoint(body.to)) {
    return json({ error: "Coordonnées from/to invalides." }, 400);
  }

  const { from, to } = body;

  const url = new URL("https://maps.googleapis.com/maps/api/directions/json");
  url.searchParams.set("origin", `${from.lat},${from.lng}`);
  url.searchParams.set("destination", `${to.lat},${to.lng}`);
  url.searchParams.set("mode", "driving");
  url.searchParams.set("region", "mr");
  url.searchParams.set("language", "fr");
  url.searchParams.set("key", GOOGLE_MAPS_API_KEY);

  let googleData: {
    status?: string;
    error_message?: string;
    routes?: Array<{
      overview_polyline?: { points?: string };
      legs?: Array<{
        distance?: { value?: number };
        duration?: { value?: number };
      }>;
    }>;
  };

  try {
    const res = await fetch(url.toString());
    googleData = await res.json();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur réseau";
    return json({ error: msg }, 502);
  }

  if (googleData.status !== "OK" || !googleData.routes?.[0]) {
    return json(
      {
        error: googleData.error_message ?? googleData.status ?? "Directions indisponibles",
        status: googleData.status ?? "UNKNOWN",
      },
      502
    );
  }

  const route = googleData.routes[0];
  const leg = route.legs?.[0];
  const polyline = route.overview_polyline?.points ?? "";
  const distanceM = leg?.distance?.value;
  const durationS = leg?.duration?.value;

  if (!isValidCoord(distanceM) || !polyline) {
    return json({ error: "Réponse Google Directions incomplète." }, 502);
  }

  return json({
    distanceM,
    durationS: isValidCoord(durationS) ? durationS : 0,
    polyline,
    provider: "google",
  });
});
