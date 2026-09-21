// Déployer : supabase functions deploy admin-book-passenger --project-ref prfmqfnaqtmyfyxqjeli
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

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function normalizePhone(raw: string): string {
  let digits = (raw || "").replace(/\D/g, "");
  if (digits.startsWith("222") && digits.length === 11) digits = digits.slice(3);
  return digits;
}

function phoneToEmail(raw: string): string {
  return `${normalizePhone(raw)}@phone.easydunya.app`;
}

function phoneToCallBookingPassword(raw: string): string {
  return `ES${normalizePhone(raw)}`;
}

function generateConfirmationCode(length = 6): string {
  const bound = Math.floor(0x100000000 / CODE_ALPHABET.length) * CODE_ALPHABET.length;
  const buf = new Uint32Array(1);
  let out = "";
  while (out.length < length) {
    crypto.getRandomValues(buf);
    if (buf[0] < bound) out += CODE_ALPHABET[buf[0] % CODE_ALPHABET.length];
  }
  return out;
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

  const { data: exact } = await admin
    .from("profiles")
    .select("id, role, full_name, phone")
    .eq("phone", target)
    .maybeSingle();
  if (exact) return exact;

  const { data, error } = await admin
    .from("profiles")
    .select("id, role, full_name, phone")
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
    tripId?: string;
    fullName?: string;
    phone?: string;
    seats?: number;
    pickupQuartier?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Corps JSON invalide." }, 400);
  }

  const tripId = (body.tripId ?? "").trim();
  const fullName = (body.fullName ?? "").trim();
  const phone = normalizePhone(body.phone ?? "");
  const seats = Math.floor(Number(body.seats ?? 1));
  const pickupQuartier = (body.pickupQuartier ?? "").trim() || null;
  const password = phoneToCallBookingPassword(phone);

  if (!tripId) return json({ error: "Voyage requis." }, 400);
  if (!fullName) return json({ error: "Nom du passager requis." }, 400);
  if (phone.length < 8 || phone.length > 15) {
    return json({ error: "Numéro de téléphone invalide." }, 400);
  }
  if (!Number.isFinite(seats) || seats < 1 || seats > 60) {
    return json({ error: "Nombre de places invalide." }, 400);
  }

  const { data: trip, error: tripError } = await admin
    .from("trips")
    .select("id, status, seats_available")
    .eq("id", tripId)
    .maybeSingle();
  if (tripError || !trip) {
    return json({ error: "Voyage introuvable." }, 404);
  }
  if (trip.status !== "scheduled") {
    return json({ error: "Ce voyage n'est plus disponible à la réservation." }, 409);
  }
  if ((trip.seats_available ?? 0) < seats) {
    return json(
      { error: `Plus assez de places (${trip.seats_available ?? 0} dispo).` },
      409
    );
  }

  const existing = await findProfileByPhone(phone);
  let passengerId: string | null = null;
  let accountCreated = false;

  if (existing) {
    if (existing.role !== "passenger") {
      return json(
        { error: "Ce numéro appartient déjà à un chauffeur ou un administrateur." },
        409
      );
    }
    passengerId = existing.id;
  } else {
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: phoneToEmail(phone),
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
      return json({ error: "Impossible de créer le compte passager." }, 400);
    }
    passengerId = created.user?.id ?? null;
    if (!passengerId) {
      return json({ error: "Création du compte échouée." }, 500);
    }
    accountCreated = true;
    await admin.from("profiles").upsert(
      {
        id: passengerId,
        role: "passenger",
        full_name: fullName,
        phone,
        must_change_password: true,
      },
      { onConflict: "id" }
    );
  }

  const { data: alreadyRows } = await admin
    .from("bookings")
    .select("id, status, confirmation_code")
    .eq("trip_id", tripId)
    .eq("passenger_id", passengerId)
    .in("status", ["pending", "confirmed"])
    .limit(1);
  const already = alreadyRows?.[0];
  if (already) {
    return json(
      {
        error: "Ce passager a déjà une réservation sur ce voyage.",
        confirmationCode: already.confirmation_code,
      },
      409
    );
  }

  const confirmationCode = generateConfirmationCode();
  const { data: booking, error: bookingError } = await admin
    .from("bookings")
    .insert({
      trip_id: tripId,
      passenger_id: passengerId,
      guest_name: fullName,
      guest_phone: phone,
      seats,
      confirmation_code: confirmationCode,
      status: "pending",
      pickup_quartier: pickupQuartier,
      is_waiting: false,
    })
    .select("id, confirmation_code, status, seats")
    .single();

  if (bookingError || !booking) {
    if (accountCreated && passengerId) {
      await admin.auth.admin.deleteUser(passengerId);
    }
    const msg = bookingError?.message ?? "";
    if (/row-level security/i.test(msg)) {
      return json({ error: "Réservation refusée (droits admin)." }, 403);
    }
    return json({ error: msg || "Impossible de créer la réservation." }, 400);
  }

  return json({
    ok: true,
    accountCreated,
    password: accountCreated ? password : null,
    passengerId,
    bookingId: booking.id,
    confirmationCode: booking.confirmation_code,
    status: booking.status,
    seats: booking.seats,
  });
});
