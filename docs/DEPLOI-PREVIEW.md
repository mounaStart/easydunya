# Déployer une nouvelle version SANS écraser la production

La production reste sur **`main`** → https://easydunya.netlify.app/

## 1. Branche de prévisualisation (GitHub)

```powershell
cd C:\Projets\EASYDUNYA1
git checkout preview/local-updates
git push -u origin preview/local-updates
```

Ne fusionnez **pas** dans `main` tant que vous n'avez pas validé la preview.

## 2. Netlify — Deploy Preview (URL séparée)

Si Netlify est connecté au dépôt GitHub `mounaStart/easydunya` :

1. Chaque push sur `preview/local-updates` crée une **Deploy Preview**
2. URL du type : `https://deploy-preview-XX--easydunya.netlify.app`
3. **`easydunya.netlify.app` (main) ne change pas**

Dans Netlify → **Site configuration** → **Build & deploy** → vérifiez que les **Deploy Previews** sont activés.

Variables d'environnement (Site settings → Environment variables) — mêmes clés que la prod :

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_VAPID_PUBLIC_KEY`
- `VITE_DEFAULT_LOCALE`

## 3. APK de test (GitHub Actions)

1. GitHub → **Actions** → **Build Android APK** → **Run workflow**
2. **ref** : `preview/local-updates`
3. **capacitor_server_url** : URL de la Deploy Preview Netlify (étape 2)
4. Téléchargez l'artifact **EasyDunya-apk**

L'APK de **production** (URL `easydunya.netlify.app`) reste inchangé tant que vous lancez le workflow avec `ref: main`.

## 4. Mettre en production (plus tard)

Quand la preview vous convient :

```powershell
git checkout main
git merge preview/local-updates
git push origin main
```

Netlify redéploiera alors `easydunya.netlify.app`.
