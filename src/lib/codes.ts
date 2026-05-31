// Génération de codes de confirmation lisibles (sans 0/O/1/I/L)
// Format : 6 caractères alphanumériques en majuscules

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateConfirmationCode(length = 6): string {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const arr = new Uint32Array(length);
    crypto.getRandomValues(arr);
    let out = "";
    for (let i = 0; i < length; i++) {
      out += ALPHABET[arr[i] % ALPHABET.length];
    }
    return out;
  }
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
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
