/** Version des CGU — incrémenter pour redemander l'acceptation. */
export const TERMS_VERSION = "1";

const STORAGE_KEY = "ed_terms_accepted";

type StoredTerms = {
  version: string;
  acceptedAt: string;
};

export function hasAcceptedTerms(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as StoredTerms;
    return parsed.version === TERMS_VERSION;
  } catch {
    return false;
  }
}

export function acceptTerms(): void {
  const payload: StoredTerms = {
    version: TERMS_VERSION,
    acceptedAt: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}
