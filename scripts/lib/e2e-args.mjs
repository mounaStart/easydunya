/** Arguments CLI / env pour les scripts E2E (--from, --to). */

export const CITY_ALIASES = {
  nouakchott: "Nouakchott",
  nkc: "Nouakchott",
  aleg: "Aleg",
  arafat: "Arafat",
  tevragh: "Tevragh Zeina",
  tevrag: "Tevragh Zeina",
  tevrag_zeina: "Tevragh Zeina",
  "tevragh zeina": "Tevragh Zeina",
  "tevrag zeina": "Tevragh Zeina",
  rosso: "Rosso",
};

export function normalizeCityKey(input) {
  return String(input ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_-]/g, " ");
}

export function resolveCityLabel(input) {
  const key = normalizeCityKey(input);
  return CITY_ALIASES[key] ?? String(input ?? "").trim();
}

export function getArg(name, fallback = null) {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  if (hit) return hit.slice(prefix.length);
  const envKey = `E2E_${name.toUpperCase()}`;
  return process.env[envKey] ?? fallback;
}

export function getRouteFromArgs(defaultFrom = "Nouakchott", defaultTo = "Aleg") {
  return {
    from: resolveCityLabel(getArg("from", defaultFrom)),
    to: resolveCityLabel(getArg("to", defaultTo)),
  };
}
