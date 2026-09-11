#!/usr/bin/env node
const html = await (await fetch("https://easydunya.netlify.app/")).text();
const jsPath = html.match(/src="(\/assets\/index-[^"]+\.js)"/)?.[1];
if (!jsPath) {
  console.error("JS bundle not found");
  process.exit(1);
}
const js = await (await fetch("https://easydunya.netlify.app" + jsPath)).text();
const key = js.match(/AIzaSy[A-Za-z0-9_-]{30,}/)?.[0];
if (!key) {
  console.error("No AIzaSy key in bundle");
  process.exit(1);
}
console.log("Key in Netlify bundle:", key.slice(0, 20) + "...");
console.log("Key suffix (last 4 chars):", key.slice(-4));

const referer = "https://easydunya.netlify.app/";
const mapsRes = await fetch(
  `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly`,
  { headers: { Referer: referer } }
);
const mapsText = await mapsRes.text();
console.log("Maps JS HTTP:", mapsRes.status);
for (const err of [
  "RefererNotAllowedMapError",
  "InvalidKeyMapError",
  "ApiNotActivatedMapError",
  "BillingNotEnabledMapError",
]) {
  if (mapsText.includes(err)) console.log("ERROR:", err);
}
if (mapsText.includes("google.maps")) console.log("OK: google.maps in response");

const geoRes = await fetch(
  `https://maps.googleapis.com/maps/api/geocode/json?address=Nouakchott&key=${encodeURIComponent(key)}`,
  { headers: { Referer: referer } }
);
const geo = await geoRes.json();
console.log("Geocode API:", geo.status, geo.error_message ?? "");

for (const ref of [
  "https://easydunya.netlify.app/",
  "https://easydunya.netlify.app",
  "https://easydunya.netlify.app/driver/trips/x/bookings",
]) {
  const r = await fetch(
    `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly`,
    { headers: { Referer: ref } }
  );
  const body = await r.text();
  const denied = body.includes("RefererNotAllowedMapError") || body.includes("InvalidKeyMapError");
  console.log(`Referer ${ref}: HTTP ${r.status}${denied ? " DENIED" : " OK"}`);
}

const staticRes = await fetch(
  `https://maps.googleapis.com/maps/api/staticmap?center=18.07,-15.97&zoom=10&size=400x400&key=${encodeURIComponent(key)}`,
  { headers: { Referer: referer } }
);
console.log("Static map HTTP:", staticRes.status, staticRes.headers.get("content-type"));
if (!staticRes.ok) console.log("Static map body:", (await staticRes.text()).slice(0, 200));
