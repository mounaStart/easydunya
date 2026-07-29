// Utilitaires téléphone : l'auth Supabase est basée email. Passagers, chauffeurs
// et admin se connectent par numéro + mot de passe via un email synthétique stable.

export function normalizePhone(raw: string): string {
  let digits = (raw || "").replace(/\D/g, "");
  // Mauritanie (+222) : accepter 20986280 ou +22220986280 → même identifiant
  if (digits.startsWith("222") && digits.length === 11) {
    digits = digits.slice(3);
  }
  return digits;
}

export function phoneToEmail(raw: string): string {
  const digits = normalizePhone(raw);
  return `${digits}@phone.easydunya.app`;
}

export function isValidPhone(raw: string): boolean {
  const digits = normalizePhone(raw);
  return digits.length >= 8 && digits.length <= 15;
}
