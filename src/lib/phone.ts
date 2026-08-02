// Connexion par téléphone (+ mot de passe). Supabase stocke un identifiant interne
// invisible (jamais saisi par l'utilisateur) — seul l'admin peut se connecter par email.

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
