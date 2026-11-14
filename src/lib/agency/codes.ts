const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function agencySlugCode(slug: string): string {
  const letters = slug.replace(/[^a-zA-Z]/g, "").toUpperCase();
  return (letters.slice(0, 3) || "AGN").padEnd(3, "X");
}

/** Code lisible unique. Format dictionnaire ED-XXX-YYYYY, aussi accepté en 6 car. */
export function generateAgencyBookingCode(slug: string): string {
  const prefix = agencySlugCode(slug);
  const buf = new Uint32Array(5);
  crypto.getRandomValues(buf);
  let tail = "";
  for (let i = 0; i < 5; i++) tail += ALPHABET[buf[i] % ALPHABET.length];
  return `ED-${prefix}-${tail}`;
}

export function normalizeBookingCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}
