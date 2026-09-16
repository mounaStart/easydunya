import { restUpdate } from "./supabaseRest";
import type { Profile } from "./types";

/** Version des CGU — incrémenter pour redemander l'acceptation. */
export const TERMS_VERSION = "1";

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
  try {
    localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    /* iOS / mode privé */
  }
}

export function rememberAcceptedTerms(userId: string): void {
  writeStorage(userStorageKey(userId));
}

export function deviceHasAcceptedTerms(userId: string): boolean {
  return readStorage(userStorageKey(userId)) !== null;
}

/** Compte connecté : CGU acceptées pour cette version ? */
export function profileHasAcceptedTerms(
  profile: Profile | null | undefined
): boolean {
  if (!profile) return false;
  if (profile.terms_accepted_version === TERMS_VERSION) {
    rememberAcceptedTerms(profile.id);
    return true;
  }
  return deviceHasAcceptedTerms(profile.id);
}

/**
 * null = auth en cours (attendre avant d'afficher l'app ou le gate).
 * true = accès autorisé (visiteur ou CGU déjà acceptées).
 * false = utilisateur connecté, CGU à afficher.
 */
export function resolveTermsAccepted(opts: {
  userId: string | null | undefined;
  profile: Profile | null | undefined;
  authPending: boolean;
  profileHydrated?: boolean;
}): boolean | null {
  if (!opts.userId) {
    return opts.authPending ? null : true;
  }
  if (deviceHasAcceptedTerms(opts.userId)) return true;
  if (opts.profile?.id === opts.userId && opts.profile.terms_accepted_version === TERMS_VERSION) {
    rememberAcceptedTerms(opts.userId);
    return true;
  }
  // Profil stub / fetch iOS en cours : ne pas afficher les CGU (déjà acceptées en base).
  if (!opts.profileHydrated) return null;
  return false;
}

export async function acceptTerms(userId: string): Promise<{ error?: string }> {
  rememberAcceptedTerms(userId);
  const { error } = await restUpdate(
    "profiles",
    { eq: { id: userId } },
    {
      terms_accepted_version: TERMS_VERSION,
      terms_accepted_at: new Date().toISOString(),
    }
  );
  if (error) console.warn("terms acceptance db update failed:", error);
  return {};
}
