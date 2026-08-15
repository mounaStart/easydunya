// Déployer : supabase functions deploy reset-user-password --project-ref prfmqfnaqtmyfyxqjeli
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

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function findProfileByPhone(phone: string) {
  const target = normalizePhone(phone);
  if (!target) return null;

  const { data, error } = await admin
    .from("profiles")
    .select("id, role, phone")
    .not("phone", "is", null)
    .limit(5000);

  if (error || !data) return null;

  return (
    data.find((row) => normalizePhone(String(row.phone ?? "")) === target) ?? null
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  let body: { phone?: string; userId?: string; newPassword?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Corps JSON invalide." }, 400);
  }

  const newPassword = body.newPassword ?? "";
  if (newPassword.length < 6) {
    return json({ error: "Le mot de passe doit contenir au moins 6 caractères." }, 400);
  }

  let targetUserId: string | null = body.userId ?? null;
  const authHeader = req.headers.get("Authorization");

  if (authHeader) {
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

    const { data: adminProfile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (adminProfile?.role === "admin") {
      if (!targetUserId && body.phone) {
        const found = await findProfileByPhone(body.phone);
        targetUserId = found?.id ?? null;
      }
    } else {
      targetUserId = user.id;
    }
  } else if (body.phone) {
    const found = await findProfileByPhone(body.phone);
    if (!found || found.role === "admin") {
      return json({ error: "Aucun compte passager ou chauffeur avec ce numéro." }, 404);
    }
    targetUserId = found.id;
  }

  if (!targetUserId) {
    return json({ error: "Utilisateur introuvable." }, 404);
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(targetUserId, {
    password: newPassword,
  });
  if (updateError) {
    return json({ error: updateError.message }, 400);
  }

  await admin
    .from("profiles")
    .update({ must_change_password: false })
    .eq("id", targetUserId);

  return json({ ok: true });
});
