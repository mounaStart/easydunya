import { supabase } from "./supabase";
import type { Profile } from "./types";

/** Version des CGU — incrémenter pour redemander l'acceptation. */
export const TERMS_VERSION = "1";

const GUEST_STORAGE_KEY = "ed_terms_guest";

type StoredTerms = {
  version: string;
  acceptedAt: string;
};

function userStorageKey(userId: string): string {
  return `ed_terms_user_${userId}`;
}

function readStorage(key: string): StoredTerms | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredTerms;
    return parsed.version === TERMS_VERSION ? parsed : null;
  } catch {
    return null;
  }
}

function writeStorage(key: string): void {
  const payload: StoredTerms = {
    version: TERMS_VERSION,
    acceptedAt: new Date().toISOString(),
  };
  localStorage.setItem(key, JSON.stringify(payload));
}

/** Compte connecté : CGU acceptées pour cette version ? */
export function profileHasAcceptedTerms(
  profile: Profile | null | undefined
): boolean {
  if (!profile) return false;
  if (profile.terms_accepted_version === TERMS_VERSION) return true;
  return readStorage(userStorageKey(profile.id)) !== null;
}

/** Visiteur non connecté : CGU acceptées sur cet appareil ? */
export function guestHasAcceptedTerms(): boolean {
  return readStorage(GUEST_STORAGE_KEY) !== null;
}

/**
 * null = auth en cours (attendre avant d'afficher l'app ou le gate).
 * true/false = décision prête.
 */
export function resolveTermsAccepted(opts: {
  userId: string | null | undefined;
  profile: Profile | null | undefined;
  authPending: boolean;
}): boolean | null {
  if (opts.authPending) return null;
  if (opts.userId) {
    if (!opts.profile || opts.profile.id !== opts.userId) return false;
    return profileHasAcceptedTerms(opts.profile);
  }
  return guestHasAcceptedTerms();
}

export async function acceptTerms(opts: {
  userId?: string | null;
}): Promise<{ error?: string }> {
  if (opts.userId) {
    writeStorage(userStorageKey(opts.userId));
    const { error } = await supabase
      .from("profiles")
      .update({
        terms_accepted_version: TERMS_VERSION,
        terms_accepted_at: new Date().toISOString(),
      })
      .eq("id", opts.userId);
    // localStorage déjà enregistré ; ignorer si colonnes DB pas encore migrées
    if (error) console.warn("terms acceptance db update failed:", error.message);
    return {};
  }

  writeStorage(GUEST_STORAGE_KEY);
  return {};
}
