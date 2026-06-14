// Utilitaires téléphone : l'auth Supabase est basée email. Pour les passagers
// et chauffeurs (qui s'authentifient par numéro), on dérive un email synthétique
// stable à partir du numéro normalisé (chiffres uniquement).

export function normalizePhone(raw: string): string {
  return (raw || "").replace(/\D/g, "");
}

export function phoneToEmail(raw: string): string {
  const digits = normalizePhone(raw);
  return `${digits}@phone.easydunya.app`;
}

export function isValidPhone(raw: string): boolean {
  const digits = normalizePhone(raw);
  return digits.length >= 8 && digits.length <= 15;
}
