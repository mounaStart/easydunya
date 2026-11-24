/** Date civile du départ (UTC = GMT / Mauritanie). */
export function departureDateUtc(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

/** True si le jour prévu du voyage est déjà passé. */
export function isDepartureDatePassed(iso: string, now = new Date()): boolean {
  return departureDateUtc(iso) < now.toISOString().slice(0, 10);
}
