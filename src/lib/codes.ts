// Génération de codes de confirmation lisibles (sans 0/O/1/I/L)
// Format : 6 caractères alphanumériques en majuscules

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

// Le code sert de clé d'accès à la réservation (nom + téléphone du passager) :
// uniquement crypto.getRandomValues (jamais Math.random, prévisible), avec
// rejet des valeurs biaisées par le modulo.
export function generateConfirmationCode(length = 6): string {
  const bound = Math.floor(0x100000000 / ALPHABET.length) * ALPHABET.length;
  const buf = new Uint32Array(1);
  let out = "";
  while (out.length < length) {
    crypto.getRandomValues(buf);
    if (buf[0] < bound) out += ALPHABET[buf[0] % ALPHABET.length];
  }
  return out;
}

export function isValidConfirmationCode(code: string): boolean {
  if (!code || code.length !== 6) return false;
  const upper = code.toUpperCase();
  for (const c of upper) {
    if (!ALPHABET.includes(c)) return false;
  }
  return true;
}
