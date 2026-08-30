# Google Directions API (distances routières = Google Maps)

Easy Dunya calcule les distances via **Google Directions API**, identiques à Google Maps (ex. Nouakchott → Aleg = **264 km**).

La clé API reste **côté serveur** (Edge Function Supabase) — jamais exposée dans l’APK ou le site.

---

## 1. Google Cloud Console

1. Ouvrez [Google Cloud Console](https://console.cloud.google.com/)
2. Créez ou sélectionnez un projet (ex. `Easy Dunya`)
3. **APIs & Services** → **Library** → activez **Directions API**
4. **APIs & Services** → **Credentials** → **Create credentials** → **API key**
5. Restreignez la clé :
   - **API restrictions** → **Restrict key** → cochez uniquement **Directions API**
   - (Pas de restriction HTTP referrer — la clé est utilisée par Supabase, pas le navigateur)

---

## 2. Secret Supabase

Dans PowerShell (après `supabase login`) :

```powershell
supabase secrets set GOOGLE_MAPS_API_KEY=VOTRE_CLE_GOOGLE --project-ref prfmqfnaqtmyfyxqjeli
```

---

## 3. Déployer l’Edge Function

```powershell
cd C:\Projets\EASYDUNYA1
supabase functions deploy directions --project-ref prfmqfnaqtmyfyxqjeli
```

Ou le script complet :

```powershell
powershell -ExecutionPolicy Bypass -File supabase/scripts/deploy_edge_functions.ps1
```

---

## 4. Vérification

Après déploiement du site (Netlify), ouvrez un voyage Nouakchott → Aleg : la distance doit afficher **~264 km** (comme Google Maps).

Si la clé n’est pas configurée, l’app utilise un **repli OSRM** (~260 km) et un avertissement apparaît dans la console développeur.

---

## Coûts Google

Directions API : environ **5 USD / 1000 requêtes** (voir [tarifs Google Maps](https://developers.google.com/maps/billing-and-pricing)).

Le cache côté app limite les appels répétés pour le même trajet.

Google offre **200 USD / mois de crédit gratuit** sur Maps Platform (suffisant pour un volume modéré).

---

## Dépannage

| Problème | Solution |
|----------|----------|
| Distance ~260 km au lieu de 264 | Clé non configurée → repli OSRM. Vérifiez le secret + déploiement `directions` |
| Erreur `REQUEST_DENIED` | Directions API non activée ou clé mal restreinte |
| Erreur `OVER_QUERY_LIMIT` | Quota dépassé — activer la facturation Google Cloud |
| Fonction 503 | `GOOGLE_MAPS_API_KEY` absent des secrets Supabase |
