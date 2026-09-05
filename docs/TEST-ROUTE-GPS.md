# Tests distance / fin de voyage (sans trajet réel)

Scripts Node pour simuler le GPS le long d’un itinéraire, sans conduire entre deux villes.

---

## 1. Test rapide (sans Supabase, sans Google)

Compare **ancienne** vs **nouvelle** méthode de distance sur Nouakchott → Aleg :

```powershell
cd C:\Projets\EASYDUNYA1
npm run test:route
```

Utilise **OSRM** (Internet requis). Affiche pour chaque point simulé :
- distance vol d’oiseau
- ancienne méthode (route GPS → centre-ville) ← cause du bug « 1,2 km »
- nouvelle méthode (le long de l’itinéraire)
- si « Terminer voyage » serait autorisé (≤ 500 m)

**Avec Google Maps (264 km)** — nécessite `.env` + secret Supabase :

```powershell
npm run test:route -- --google
```

Autre trajet :

```powershell
npm run test:route -- --from=rosso --to=aleg
```

Villes disponibles : `nouakchott`, `aleg`, `rosso`

---

## 2. Simulation pas à pas

Avance le chauffeur de 0 % à 100 % et indique à quel moment la fin est débloquée :

```powershell
npm run test:trip-end
npm run test:trip-end -- --steps=50
```

---

## 3. Test RPC Supabase (voyage réel en base)

Teste `driver_update_gps` avec un **voyage déjà en cours** dans votre base.

### Préparation (une fois)

1. Connectez-vous chauffeur sur l’app
2. Créez un voyage test, appuyez **Démarrer**
3. Copiez l’**id** du voyage (URL ou Supabase → table `trips`)
4. Ajoutez dans `.env` :

```env
TEST_DRIVER_PHONE=222XXXXXXXX
TEST_DRIVER_PASSWORD=XXXXXXXXED
TEST_TRIP_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

5. Migrations **0036** et **0037** appliquées sur Supabase

### Lancer

```powershell
npm run test:gps-rpc
```

Envoie 5 positions simulées (50 % → 100 %). À l’arrivée, la réponse doit contenir `"completed": true`.

> ⚠️ Ce test **termine réellement** le voyage si la position simulée est ≤ 500 m.

---

## 4. Test dans le navigateur (GPS simulé)

```powershell
npm run dev
```

1. Connexion chauffeur → voyage **in_progress**
2. **F12** → **Sensors** → **Location** → coordonnées custom
3. Proche Aleg : `17.0533, -13.9070`
4. Rechargez la page voyage

---

## Résultat attendu (après correctif)

| Situation | Ancienne méthode | Nouvelle méthode |
|-----------|------------------|------------------|
| Fin de route (100 %) | parfois **1,2 km** ❌ | **≤ 500 m** ✅ |
| Centre-ville | bloqué | **Terminer** débloqué |

---

## 5. Test E2E complet (4 scripts Supabase)

Sans conduire : crée un voyage, le démarre, simule le GPS à Aleg, vérifie la fin.

### Configuration `.env`

```env
VITE_SUPABASE_URL=https://prfmqfnaqtmyfyxqjeli.supabase.co
VITE_SUPABASE_ANON_KEY=votre_clé_anon
TEST_DRIVER_PHONE=222XXXXXXXX
TEST_DRIVER_PASSWORD=XXXXXXXXED
```

Le chauffeur doit être **approuvé** (`driver_status = approved`) et **sans autre voyage en cours**.

Migrations **0036** + **0037** appliquées sur Supabase.

### Les 4 étapes (une par une)

```powershell
npm run test:e2e:create      # 1. Crée Nouakchott → Aleg (scheduled)
npm run test:e2e:start       # 2. Démarre le voyage (in_progress)
npm run test:e2e:gps-aleg    # 3. GPS simulé à Aleg
npm run test:e2e:verify      # 4. Vérifie distance ≤ 500 m + termine
```

Ou tout d'un coup :

```powershell
npm run test:e2e:all
```

L'id du voyage est sauvegardé dans `scripts/.e2e-trip-state.json` (réutilisé entre les étapes).

---

### Nouakchott → Arafat / Tevragh Zeina

**Prérequis :** exécuter `supabase/migrations/0038_nouakchott_quartiers.sql` dans Supabase SQL Editor.

```powershell
# Test complet Nouakchott → Arafat
npm run test:e2e:nkc-arafat

# Test complet Nouakchott → Tevragh Zeina
npm run test:e2e:nkc-tevragh

# Test complet Arafat → Tevragh Zeina (départ Arafat, arrivée Tevragh Zeina)
npm run test:e2e:arafat-tevragh

# Ou trajet personnalisé
npm run test:e2e:route -- --from=arafat --to=tevrag_zeina
npm run test:e2e:route -- --from=nouakchott --to=arafat
```

Aliases : `nouakchott`, `arafat`, `tevragh`, `tevrag_zeina`, `aleg`

Si 0038 déjà appliquée sans le tarif Arafat→Tevragh : exécuter aussi `0039_arafat_tevragh_price.sql`.

---

## Dépannage scripts

| Erreur | Solution |
|--------|----------|
| OSRM timeout | Réessayez ; vérifiez Internet |
| `--google` échoue | Secret `GOOGLE_MAPS_API_KEY` + fonction `directions` déployée |
| RPC `does not exist` | Migration 0037 |
| `completed: false` à 100 % | Migration 0036/0037 + voyage `in_progress` + bon `TEST_TRIP_ID` |
