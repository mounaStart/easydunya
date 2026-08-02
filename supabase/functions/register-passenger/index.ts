// =====================================================================
// Edge Function: register-passenger
// Inscription passager via API Admin (contourne la validation DNS stricte
// de auth.signUp sur les emails synthétiques @phone.easydunya.app).
//
// Déployer : supabase functions deploy register-passenger --project-ref prfmqfnaqtmyfyxqjeli
// =====================================================================
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

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

  let body: { fullName?: string; phone?: string; password?: string };
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

  const { data: taken, error: rpcError } = await admin.rpc("is_phone_taken", {
    p_phone: phone,
  });
  if (rpcError) {
    return json({ error: rpcError.message }, 500);
  }
  if (taken === true) {
    return json({ error: "Ce numéro de téléphone est déjà utilisé." }, 409);
  }

  const email = phoneToEmail(phone);
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      phone,
      role: "passenger",
    },
  });

  if (createError) {
    const msg = createError.message.toLowerCase();
    if (msg.includes("already") || msg.includes("exists")) {
      return json({ error: "Ce numéro de téléphone est déjà utilisé." }, 409);
    }
    return json({ error: "Impossible de créer le compte avec ce numéro." }, 400);
  }

  const userId = created.user?.id;
  if (userId) {
    await admin.from("profiles").upsert(
      {
        id: userId,
        role: "passenger",
        full_name: fullName,
        phone,
      },
      { onConflict: "id" }
    );
  }

  return json({ ok: true });
});
