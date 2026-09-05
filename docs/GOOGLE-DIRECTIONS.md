# Google Directions API (Solution B — itinéraires routiers)

Easy Dunya trace les trajets via **Google Directions API** (Edge Function Supabase `directions`), identique à Google Maps (ex. Nouakchott → Aleg ≈ **264 km** via Boutilimit).

**Deux clés distinctes (obligatoire) :**

| Clé | Où | Restrictions Google Cloud | Usage |
|-----|-----|---------------------------|--------|
| `VITE_GOOGLE_MAPS_API_KEY` | `.env`, **Netlify**, **GitHub Secrets** (APK) | **Sites web** (referrers) + Maps JavaScript + Geocoding | Carte navigateur + APK |
| `GOOGLE_MAPS_API_KEY` | Secret Supabase uniquement | **Aucun referrer** — API restriction **Directions API** seulement | Edge Function `directions` (serveur) |

> ⚠️ **Ne pas réutiliser la clé frontend pour Supabase.**  
> Erreur typique : `API keys with referer restrictions cannot be used with this API` → la clé serveur a des referrers HTTP ; créez une **2ᵉ clé** sans restriction de sites web.

Sans la clé Supabase valide, la carte affiche une **ligne orange pointillée** (vol d'oiseau) + bandeau d'avertissement — ce n'est **pas** un bug de destination.

---

## 1. Google Cloud Console

1. [Google Cloud Console](https://console.cloud.google.com/)
2. **APIs & Services** → **Library** → activer :
   - **Directions API** (obligatoire pour les trajets)
   - **Maps JavaScript API** + **Geocoding API** (carte frontend)
3. **Credentials** → créer **deux clés API** :
   - **Clé 1 — Frontend** (`VITE_GOOGLE_MAPS_API_KEY`) : restriction **Sites web** + Maps JavaScript + Geocoding
   - **Clé 2 — Serveur** (`GOOGLE_MAPS_API_KEY`) : restriction **API** (Directions uniquement), **sans** referrers HTTP
4. Restreindre la clé **Serveur** :
   - **Application restrictions** → **None** (pas de sites web)
   - **API restrictions** → **Restrict key** → **Directions API** uniquement

---

## 2. Secret Supabase

```powershell
supabase secrets set GOOGLE_MAPS_API_KEY=VOTRE_CLE_GOOGLE --project-ref prfmqfnaqtmyfyxqjeli
```

---

## 3. Déployer l'Edge Function

```powershell
cd C:\Projets\EASYDUNYA1
supabase functions deploy directions --project-ref prfmqfnaqtmyfyxqjeli
```

---

## 4. Vérification (curl / script)

### Test automatique (recommandé)

```powershell
cd C:\Projets\EASYDUNYA1
npm run test:directions
```

Lit `.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) et appelle la fonction `directions` pour Nouakchott → Aleg.

**Succès attendu :**
- `provider: "google"`
- `distanceM` ≈ **264 000** (264 km)
- `polyline` non vide

**Échec typique :**
- `503` + `GOOGLE_MAPS_API_KEY non configurée` → secret manquant
- `502` + `REQUEST_DENIED` → Directions API inactive ou clé invalide

### Test curl manuel

Remplacez `ANON_KEY` et l'URL Supabase :

```powershell
curl -X POST "https://prfmqfnaqtmyfyxqjeli.supabase.co/functions/v1/directions" `
  -H "Authorization: Bearer ANON_KEY" `
  -H "Content-Type: application/json" `
  -d "{\"from\":{\"lat\":17.0522,\"lng\":-13.9179},\"to\":{\"lat\":18.0681,\"lng\":-15.9700}}"
```

### Test Google direct (sans Supabase)

```powershell
curl "https://maps.googleapis.com/maps/api/directions/json?origin=17.0522,-13.9179&destination=18.0681,-15.9700&mode=driving&key=VOTRE_CLE"
```

Si curl Google OK mais Supabase 503 → secret / déploiement `directions` manquant.

---

## 5. Vérification dans l'app

1. `npm run dev` → voyage en cours avec carte
2. **Ligne bleue épaisse** = Google Directions OK
3. **Ligne orange pointillée** + bandeau amber = Google Directions indisponible
4. Console (F12) : `[routing] Google Directions: ...` en cas d'erreur

---

## Coûts

Directions API : ~5 USD / 1000 requêtes. Crédit gratuit Google Maps : **200 USD/mois**. Cache côté app pour limiter les appels.

---

---

## 6. APK Android (GitHub Actions)

L'APK **embarque** le `dist/` compilé (plus de chargement Netlify par défaut). La clé doit être :

1. **GitHub** → repo → Settings → Secrets → `VITE_GOOGLE_MAPS_API_KEY`
2. **Google Cloud** → clé frontend → referrers HTTP :
   - `https://easydunya.netlify.app/*`
   - `http://localhost:5173/*`
   - **`https://localhost/*`** (WebView Capacitor dans l'APK)

Relancer : **Actions** → **Build Android APK** → **Run workflow** (laisser « URL distante » **vide**).

**Netlify** (site web) : ajouter aussi `VITE_GOOGLE_MAPS_API_KEY` dans Environment variables puis redéployer.

---

## Dépannage

| Problème | Solution |
|----------|----------|
| Ligne droite à travers le désert | `GOOGLE_MAPS_API_KEY` + `supabase functions deploy directions` |
| Carte grise APK « clé manquante » | Secret GitHub `VITE_GOOGLE_MAPS_API_KEY` + rebuild APK (dist embarqué) |
| Carte grise navigateur | `VITE_GOOGLE_MAPS_API_KEY` sur **Netlify** + redeploy |
| `REQUEST_DENIED` + referer restrictions | Clé Supabase = clé frontend. Créez une **2ᵉ clé** sans referrers (voir ci-dessus) |
| `REQUEST_DENIED` | Activer Directions API sur le projet Google |
| `503` sur `/directions` | Secret Supabase non défini |
| Distance OK mais carte fallback | Redéployer le frontend (Netlify) |
