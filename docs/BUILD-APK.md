# Générer un APK Android (Easy Dunya)

Easy Dunya est une **PWA**. Pour un APK de test, la méthode la plus simple est **[PWABuilder](https://www.pwabuilder.com/)** (gratuit, comme dans la présentation produit).

> **Prérequis** : l’app doit être accessible en **HTTPS** sur Internet (pas seulement `localhost`). PWABuilder analyse votre URL en ligne.

---

## Étape 1 — Préparer le build

Dans PowerShell :

```powershell
cd C:\Projets\EASYDUNYA1

# Vérifiez que .env contient vos vraies clés Supabase Cloud
# VITE_SUPABASE_URL=https://pqljcsnsyvacobdmpqgn.supabase.co
# VITE_SUPABASE_ANON_KEY=sb_publishable_...

npm install
npm run build
```

Le dossier **`dist/`** contient l’application prête à publier.

---

## Étape 2 — Mettre l’app en ligne (HTTPS)

Choisissez **une** option :

### Option A — Netlify Drop (le plus rapide, ~2 min)

1. Allez sur https://app.netlify.com/drop
2. Glissez-déposez le dossier **`dist`** entier
3. Netlify vous donne une URL du type : `https://random-name-123.netlify.app`
4. Gardez cette URL pour l’étape 3

### Option B — Vercel

```powershell
npx vercel dist --prod
```

Suivez les instructions → URL `https://xxx.vercel.app`

### Option C — Votre serveur (Coolify / Nginx)

Copiez le contenu de `dist/` vers votre serveur web (comme pour la prod `map.senhabitat360.sn`).

### Option D — Test temporaire avec ngrok (sans déployer)

```powershell
npm run preview
# Dans un autre terminal :
npx ngrok http 4173
```

Utilisez l’URL **https** fournie par ngrok (ex. `https://abc123.ngrok-free.app`).

---

## Étape 3 — PWABuilder → APK

1. Ouvrez **https://www.pwabuilder.com/**
2. Collez votre URL HTTPS (Netlify, Vercel, ngrok, etc.)
3. Cliquez **Start** → attendez l’analyse
4. Corrigez les avertissements si demandé (icônes 512×512 : normalement OK)
5. Cliquez **Package For Stores** → **Android**
6. Choisissez **Other Android** (APK de test, pas Play Store)
7. Renseignez :
   - **Package ID** : `mr.easydunya.app` (ou `sn.easydunya.app`)
   - **App name** : Easy Dunya
   - **Signing key** : pour un **test rapide**, PWABuilder peut générer une clé de debug
8. **Generate** → téléchargez le **`.apk`**

---

## Étape 4 — Installer sur votre téléphone

1. Transférez le `.apk` sur le téléphone (USB, WhatsApp, email, Google Drive)
2. Sur Android : **Paramètres** → **Sécurité** → autoriser **Sources inconnues** (ou « Installer apps inconnues » pour Chrome/Fichiers)
3. Ouvrez le fichier APK → **Installer**
4. Lancez **Easy Dunya**

> Pour les tests Supabase : le téléphone doit avoir **Internet** (Wi‑Fi ou 4G). Les clés Supabase sont incluses dans le build au moment de `npm run build`.

---

## Étape 5 — Après chaque modification du code

```powershell
npm run build
# Re-uploadez dist/ sur Netlify (même site → URL identique)
# Regénérez l’APK sur PWABuilder OU réinstallez seulement si vous changez l’URL
```

Si vous gardez la **même URL** Netlify et que l’APK charge cette URL (mode TWA / WebView), souvent **pas besoin de refaire l’APK** : l’app se met à jour toute seule au prochain lancement (PWA + cache).

---

## Dépannage

| Problème | Solution |
|----------|----------|
| PWABuilder ne trouve pas le manifest | Vérifiez que l’URL ouvre bien l’accueil (pas 404). Testez `/` dans le navigateur |
| App blanche sur le téléphone | `.env` manquant au `npm run build` → rebuild avec les bonnes clés |
| « Failed to fetch » sur mobile | Supabase URL/clé incorrectes dans le build, ou CORS (normalement OK sur Supabase Cloud) |
| Carte ne s’affiche pas | Autoriser Internet pour l’app ; tuiles OSM nécessitent le réseau |
| Install APK bloqué | Autoriser sources inconnues (voir étape 4) |

---

## Alternative : Bubblewrap (ligne de commande)

Pour développeurs Android / JDK installé :

```powershell
npm install -g @bubblewrap/cli
bubblewrap init --manifest https://VOTRE-URL.netlify.app/manifest.webmanifest
bubblewrap build
```

APK dans `app/build/outputs/apk/`.

---

## Icônes

Les icônes PWA sont dans `public/icons/` (192 et 512). Pour les régénérer :

```powershell
npm run icons
```
