import { supabase } from "./supabase";

/** Suppression du compte connecté (politique User Data Google Play). */
export async function deleteOwnAccount(): Promise<{ error?: string }> {
  const { data, error } = await supabase.functions.invoke("delete-own-account", {
    body: {},
  });
  if (error) return { error: error.message };
  const payload =
    data && typeof data === "object" ? (data as { error?: string }) : null;
  if (payload?.error) return { error: payload.error };
  return {};
}
