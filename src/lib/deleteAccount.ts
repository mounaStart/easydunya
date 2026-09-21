import { invokeEdgeFunction } from "./supabaseRpc";

/** Suppression du compte connecté (guideline App Store 5.1.1v). */
export async function deleteOwnAccount(): Promise<{ error?: string }> {
  const { error } = await invokeEdgeFunction("delete-own-account", {});
  return error ? { error } : {};
}
