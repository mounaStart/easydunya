// =====================================================================
// Edge Function: send-push
// Reçoit { user_id, title, body, data } (appelée par le trigger SQL
// trg_notifications_push) et envoie une notification Web Push à tous
// les appareils enregistrés de l'utilisateur.
//
// Secrets requis (supabase secrets set ...) :
//   VAPID_PUBLIC_KEY   clé publique VAPID
//   VAPID_PRIVATE_KEY  clé privée VAPID
//   VAPID_SUBJECT      mailto:contact@easydunya.app (ou une URL)
// Fournis automatiquement par Supabase :
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// =====================================================================
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:contact@easydunya.app";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

interface PushPayload {
  user_id?: string;
  title?: string;
  body?: string | null;
  data?: Record<string, unknown> | null;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
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

  const { data: subs, error } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", user_id);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
  if (!subs || subs.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const notificationPayload = JSON.stringify({
    title,
    body: body ?? "",
    data: data ?? {},
  });

  let sent = 0;
  const staleIds: string[] = [];

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
          },
          notificationPayload,
        );
        sent++;
      } catch (err: unknown) {
        const statusCode =
          typeof err === "object" && err !== null && "statusCode" in err
            ? (err as { statusCode?: number }).statusCode
            : undefined;
        // 404/410 = abonnement expiré → on le supprime
        if (statusCode === 404 || statusCode === 410) {
          staleIds.push(s.id);
        }
      }
    }),
  );

  if (staleIds.length > 0) {
    await admin.from("push_subscriptions").delete().in("id", staleIds);
  }

  return new Response(JSON.stringify({ sent, removed: staleIds.length }), {
    headers: { "Content-Type": "application/json" },
  });
});
