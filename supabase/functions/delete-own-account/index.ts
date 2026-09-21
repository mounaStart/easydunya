// Déployer : npx supabase functions deploy delete-own-account --project-ref prfmqfnaqtmyfyxqjeli
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return json({ error: "Session invalide." }, 401);
  }

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();
  if (userError || !user) {
    return json({ error: "Session invalide." }, 401);
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("id, role, current_trip_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role === "admin") {
    const { count } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if ((count ?? 0) <= 1) {
      return json(
        {
          error:
            "Impossible de supprimer le dernier compte administrateur. Contactez le support.",
        },
        400
      );
    }
  }

  if (profile?.current_trip_id) {
    const { data: locked } = await admin
      .from("trips")
      .select("status")
      .eq("id", profile.current_trip_id)
      .maybeSingle();
    if (locked?.status === "in_progress") {
      return json(
        { error: "Terminez le voyage en cours avant de supprimer le compte." },
        400
      );
    }
  }

  const { data: liveTrips } = await admin
    .from("trips")
    .select("id")
    .eq("driver_id", user.id)
    .eq("status", "in_progress");
  if (liveTrips && liveTrips.length > 0) {
    return json(
      { error: "Terminez le voyage en cours avant de supprimer le compte." },
      400
    );
  }

  await admin
    .from("trips")
    .update({ status: "cancelled" })
    .eq("driver_id", user.id)
    .eq("status", "scheduled");

  await admin.from("bookings").delete().eq("passenger_id", user.id);

  const { data: driverTrips } = await admin
    .from("trips")
    .select("id")
    .eq("driver_id", user.id);
  const tripIds = (driverTrips ?? []).map((row) => row.id);
  if (tripIds.length > 0) {
    await admin.from("bookings").delete().in("trip_id", tripIds);
  }

  await admin.from("device_tokens").delete().eq("user_id", user.id);
  await admin.from("notifications").delete().eq("user_id", user.id);
  await admin.from("push_subscriptions").delete().eq("user_id", user.id);

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    return json({ error: deleteError.message }, 400);
  }

  return json({ ok: true });
});
