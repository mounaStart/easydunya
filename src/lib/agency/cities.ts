/** 14 villes du dictionnaire, ids alignés sur seed.sql (Akjoujt hors seed). */
export const AGENCY_CITIES = [
  { id: "11111111-1111-1111-1111-000000000001", name_fr: "Nouakchott", name_ar: "نواكشوط", lat: 18.0681, lng: -15.97 },
  { id: "11111111-1111-1111-1111-000000000004", name_fr: "Boghé", name_ar: "بوغي", lat: 16.5925, lng: -14.2756 },
  { id: "11111111-1111-1111-1111-000000000005", name_fr: "Kaédi", name_ar: "كيهيدي", lat: 16.1487, lng: -13.511 },
  { id: "11111111-1111-1111-1111-000000000012", name_fr: "Sélibaby", name_ar: "سيليبابي", lat: 15.1699, lng: -12.1902 },
  { id: "11111111-1111-1111-1111-000000000003", name_fr: "Rosso", name_ar: "روصو", lat: 16.5223, lng: -15.8109 },
  { id: "11111111-1111-1111-1111-000000000006", name_fr: "Aleg", name_ar: "ألاك", lat: 17.0522, lng: -13.9179 },
  { id: "11111111-1111-1111-1111-000000000007", name_fr: "Kiffa", name_ar: "كيفا", lat: 16.6167, lng: -11.4144 },
  { id: "11111111-1111-1111-1111-000000000010", name_fr: "Atar", name_ar: "أطار", lat: 20.5146, lng: -13.055 },
  { id: "11111111-1111-1111-1111-000000000002", name_fr: "Nouadhibou", name_ar: "نواذيبو", lat: 20.9456, lng: -17.035 },
  { id: "11111111-1111-1111-1111-000000000009", name_fr: "Néma", name_ar: "النعمة", lat: 16.6126, lng: -7.2579 },
  { id: "11111111-1111-1111-1111-000000000008", name_fr: "Aïoun", name_ar: "العيون", lat: 16.661, lng: -9.6204 },
  { id: "11111111-1111-1111-1111-000000000013", name_fr: "Tidjikja", name_ar: "تجكجة", lat: 18.5421, lng: -11.4415 },
  { id: "11111111-1111-1111-1111-000000000011", name_fr: "Zouérate", name_ar: "الزويرات", lat: 22.7268, lng: -12.4786 },
  { id: "11111111-1111-1111-1111-000000000016", name_fr: "Akjoujt", name_ar: "أكجوجت", lat: 19.746, lng: -14.391 },
] as const;

export const FALLBACK_TRIP_CITIES = AGENCY_CITIES.map((c) => ({
  id: c.id,
  name_fr: c.name_fr,
  name_ar: c.name_ar,
}));

export function cityById(id: string) {
  return AGENCY_CITIES.find((c) => c.id === id);
}

export function cityByName(name: string) {
  const n = name.trim().toLowerCase();
  return AGENCY_CITIES.find((c) => c.name_fr.toLowerCase() === n);
}
