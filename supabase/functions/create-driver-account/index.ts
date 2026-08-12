// Déployer : supabase functions deploy create-driver-account --project-ref prfmqfnaqtmyfyxqjeli
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

function normalizePhone(raw: string): string {
  let digits = (raw || "").replace(/\D/g, "");
  if (digits.startsWith("222") && digits.length === 11) digits = digits.slice(3);
  return digits;
}

function phoneToEmail(raw: string): string {
  return `${normalizePhone(raw)}@phone.easydunya.app`;
}

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
    return json({ error: "Connexion admin requise." }, 401);
  }

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return json({ error: "Session invalide." }, 401);
  }

  const { data: adminProfile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (adminProfile?.role !== "admin") {
    return json({ error: "Accès réservé à l'administrateur." }, 403);
  }

  let body: {
    fullName?: string;
    phone?: string;
    password?: string;
    baseCityId?: string;
    vehicleMake?: string;
    vehiclePlate?: string;
    vehicleSeats?: number;
    vehicleFeatures?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Corps JSON invalide." }, 400);
  }

  const fullName = (body.fullName ?? "").trim();
  const phone = normalizePhone(body.phone ?? "");
  const password = body.password ?? "";

  if (!fullName) return json({ error: "Nom complet requis." }, 400);
  if (phone.length < 8 || phone.length > 15) {
    return json({ error: "Numéro de téléphone invalide." }, 400);
  }
  if (password.length < 6) {
    return json({ error: "Le mot de passe doit contenir au moins 6 caractères." }, 400);
  }

  const { data: taken } = await admin.rpc("is_phone_taken", { p_phone: phone });
  if (taken === true) {
    return json({ error: "Ce numéro de téléphone est déjà utilisé." }, 409);
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: phoneToEmail(phone),
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      phone,
      role: "driver",
    },
  });

  if (createError) {
    const msg = createError.message.toLowerCase();
    if (msg.includes("already") || msg.includes("exists")) {
      return json({ error: "Ce numéro de téléphone est déjà utilisé." }, 409);
    }
    return json({ error: "Impossible de créer le compte chauffeur." }, 400);
  }

  const userId = created.user?.id;
  if (!userId) return json({ error: "Création du compte échouée." }, 500);

  const profileUpdate: Record<string, unknown> = {
    id: userId,
    role: "driver",
    full_name: fullName,
    phone,
    driver_status: "pending",
    must_change_password: true,
  };
  if (body.baseCityId) profileUpdate.base_city_id = body.baseCityId;

  await admin.from("profiles").upsert(profileUpdate, { onConflict: "id" });

  if (body.vehicleMake?.trim() && body.vehiclePlate?.trim()) {
    await admin.from("vehicles").insert({
      driver_id: userId,
      make: body.vehicleMake.trim(),
      plate: body.vehiclePlate.trim(),
      seats: body.vehicleSeats && body.vehicleSeats > 0 ? body.vehicleSeats : 8,
      features: body.vehicleFeatures?.trim() || null,
    });
  }

  return json({ ok: true, userId });
});
