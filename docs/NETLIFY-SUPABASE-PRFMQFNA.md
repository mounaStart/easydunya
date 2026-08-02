# Connecter Netlify à prfmqfnaqtmyfyxqjeli

Les scripts SQL Supabase **ne changent pas** Netlify.  
Il faut modifier les **variables d'environnement** puis **redéployer**.

---

## Étape 1 — Récupérer les clés Supabase

1. Ouvrez : https://supabase.com/dashboard/project/prfmqfnaqtmyfyxqjeli/settings/api
2. Copiez :
   - **Project URL** → `https://prfmqfnaqtmyfyxqjeli.supabase.co`
   - **anon public** (Publishable key) → commence par `sb_publishable_…` ou `eyJ…`

---

## Étape 2 — Netlify (OBLIGATOIRE)

1. https://app.netlify.com/ → site **easydunya**
2. **Site configuration** → **Environment variables**
3. Modifiez (ou créez) :

| Variable | Valeur |
|----------|--------|
| `VITE_SUPABASE_URL` | `https://prfmqfnaqtmyfyxqjeli.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | clé **anon** copiée à l'étape 1 |
| `VITE_DEFAULT_LOCALE` | `fr` |
| `VITE_VAPID_PUBLIC_KEY` | (laisser l'ancienne valeur si vous l'avez) |

4. **Scope** : Production (et Deploy Previews si besoin)

---

## Étape 3 — Redéployer (OBLIGATOIRE)

Sans redéploiement, le site garde l'**ancienne** base en cache.

1. **Deploys** → **Trigger deploy**
2. Choisir **Clear cache and deploy site**
3. Attendre la fin (~2 min)

---

## Étape 4 — Vérifier que ça marche

1. Ouvrir https://easydunya.netlify.app/login
2. **F12** → onglet **Network** (Réseau)
3. Se connecter → chercher une requête vers `supabase.co`

✅ Bon : `prfmqfnaqtmyfyxqjeli.supabase.co`  
❌ Mauvais : `pqljcsnsyvacobdmpqgn.supabase.co` → variables Netlify pas appliquées ou pas redéployé

---

## Étape 5 — Auth Supabase

Sur **prfmqfna…** :

**Authentication** → **Providers** → **Email** → **Enabled**

Sinon : erreur « Email logins are disabled ».

---

## Étape 6 — Fichier `.env` local (PC)

```env
VITE_SUPABASE_URL=https://prfmqfnaqtmyfyxqjeli.supabase.co
VITE_SUPABASE_ANON_KEY=<même clé que Netlify>
```

Puis : `npm run dev`

---

## Étape 7 — GitHub (APK)

**Settings** → **Secrets** → `VITE_SUPABASE_ANON_KEY` = clé prfmqfna…

Puis relancer **Build Android APK**.

---

## Connexion test

- Téléphone : `20986280`
- Mot de passe : celui défini dans Authentication (prfmqfna…)

Les comptes de l'**ancienne** base (`pqljcsns…`) **ne fonctionnent pas** sur la nouvelle.

---

## Notifications sur le téléphone (FCM)

La cloche marche dès que la table `notifications` est remplie.  
La **barre Android** exige la même config que l’ancien projet sur **prfmqfna** :

1. Secret **`FCM_SERVICE_ACCOUNT`** (JSON Firebase) → Edge Functions → Secrets  
2. SQL **`setup_notifications_prfmqfna.sql`** avec votre **service_role**  
3. Fonction **`send-fcm`** déployée  

Guide détaillé : **`docs/NOTIFICATIONS-TELEPHONE.md`**
