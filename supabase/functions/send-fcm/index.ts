// =====================================================================
// Edge Function: send-fcm
// Reçoit { user_id, title, body, data } (appelée par le trigger SQL
// trg_notifications_push) et envoie une notification FCM native à tous
// les appareils (APK) enregistrés de l'utilisateur.
//
// Affichage : « Easy Dunya » + logo, même application fermée.
//
// Secret requis (supabase secrets set ...) :
//   FCM_SERVICE_ACCOUNT  = contenu JSON du compte de service Firebase
//                          (Project settings → Service accounts →
//                           Generate new private key)
// Fournis automatiquement par Supabase :
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// =====================================================================
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const FCM_SERVICE_ACCOUNT = Deno.env.get("FCM_SERVICE_ACCOUNT") ?? "";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
  token_uri?: string;
}

interface PushPayload {
  user_id?: string;
  title?: string;
  body?: string | null;
  data?: Record<string, unknown> | null;
}

// ---- Auth compte de service → access_token OAuth2 (RS256 JWT) ----------
function base64url(input: ArrayBuffer | string): string {
  let bytes: Uint8Array;
  if (typeof input === "string") {
    bytes = new TextEncoder().encode(input);
  } else {
    bytes = new Uint8Array(input);
  }
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const raw = atob(b64);
  const buf = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return buf;
}

let cachedToken: { value: string; exp: number } | null = null;

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp - 60 > now) return cachedToken.value;

  const tokenUri = sa.token_uri ?? "https://oauth2.googleapis.com/token";
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: tokenUri,
    iat: now,
    exp: now + 3600,
  };

  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(
    JSON.stringify(claim),
  )}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned),
  );
  const jwt = `${unsigned}.${base64url(sig)}`;

  const res = await fetch(tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`OAuth token error: ${JSON.stringify(json)}`);
  }
  cachedToken = { value: json.access_token, exp: now + 3600 };
  return json.access_token;
}

// ---- Envoi FCM v1 -----------------------------------------------------
Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  if (!FCM_SERVICE_ACCOUNT) {
    return new Response("FCM_SERVICE_ACCOUNT manquant", { status: 500 });
  }

  let sa: ServiceAccount;
  try {
    sa = JSON.parse(FCM_SERVICE_ACCOUNT);
  } catch {
    return new Response("FCM_SERVICE_ACCOUNT invalide (JSON)", { status: 500 });
  }

  let payload: PushPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const { user_id, title, body, data } = payload;
  if (!user_id || !title) {
    return new Response("Missing user_id or title", { status: 400 });
  }

  const { data: tokens, error } = await admin
    .from("device_tokens")
    .select("id, token")
    .eq("user_id", user_id);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
  if (!tokens || tokens.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Les valeurs `data` FCM doivent être des chaînes.
  const dataStr: Record<string, string> = {};
  if (data && typeof data === "object") {
    for (const [k, v] of Object.entries(data)) {
      dataStr[k] = typeof v === "string" ? v : JSON.stringify(v);
    }
  }

  let accessToken: string;
  try {
    accessToken = await getAccessToken(sa);
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }

  const endpoint = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;
  let sent = 0;
  const staleIds: string[] = [];

  await Promise.all(
    tokens.map(async (t) => {
      const message = {
        message: {
          token: t.token,
          notification: { title, body: body ?? "" },
          android: {
            priority: "HIGH",
            notification: {
              sound: "default",
              default_vibrate_timings: true,
              notification_priority: "PRIORITY_HIGH",
            },
          },
          data: dataStr,
        },
      };
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(message),
        });
        if (res.ok) {
          sent++;
        } else {
          const errJson = await res.json().catch(() => ({}));
          const code = errJson?.error?.details?.[0]?.errorCode ?? errJson?.error?.status;
          // Jeton invalide / non enregistré → on le supprime
          if (
            res.status === 404 ||
            code === "UNREGISTERED" ||
            code === "INVALID_ARGUMENT"
          ) {
            staleIds.push(t.id);
          }
        }
      } catch {
        /* réseau : on réessaiera au prochain envoi */
      }
    }),
  );

  if (staleIds.length > 0) {
    await admin.from("device_tokens").delete().in("id", staleIds);
  }

  return new Response(JSON.stringify({ sent, removed: staleIds.length }), {
    headers: { "Content-Type": "application/json" },
  });
});
