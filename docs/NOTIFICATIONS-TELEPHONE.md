# Notifications sur le téléphone (comme l’ancien projet)

Sur l’**ancien** Supabase (`pqljcsns…`), ces 3 éléments étaient en place :

| Élément | Ancien projet | prfmqfna (actuel) |
|---------|---------------|-------------------|
| Edge Function `send-fcm` | ✅ | ✅ (à déployer si absent) |
| Secret `FCM_SERVICE_ACCOUNT` | ✅ | ❌ **à ajouter** |
| SQL `app_config` (edge_send_fcm_*) | ✅ | ❌ **à exécuter** |
| Token FCM dans l’APK (`device_tokens`) | ✅ après permission | après étapes ci-dessous |

La **cloche** fonctionne sans tout ça. La **barre Android** nécessite FCM.

---

## Étape 1 — Même Firebase qu’avant

Utilisez le **même projet Firebase** que l’ancien APK (package `app.easydunya`).

1. [Firebase Console](https://console.firebase.google.com/) → votre projet Easy Dunya  
2. ⚙ **Project settings** → **Service accounts**  
3. **Generate new private key** → fichier `.json`

---

## Étape 2 — Secret Supabase (prfmqfna)

1. [Supabase prfmqfna → Edge Functions → Secrets](https://supabase.com/dashboard/project/prfmqfnaqtmyfyxqjeli/functions/secrets)  
2. Ajoutez :

| Nom | Valeur |
|-----|--------|
| `FCM_SERVICE_ACCOUNT` | **collez tout le JSON** du fichier Firebase (une seule ligne ou multiligne) |

3. Vérifiez que **`send-fcm`** est déployée (Edge Functions → code = `supabase/functions/send-fcm/index.ts`, **Verify JWT activé**)

---

## Étape 3 — SQL (comme l’ancien `app_config`)

1. [SQL Editor prfmqfna](https://supabase.com/dashboard/project/prfmqfnaqtmyfyxqjeli/sql/new)  
2. Ouvrez `supabase/scripts/setup_notifications_prfmqfna.sql`  
3. Remplacez `<SERVICE_ROLE_KEY>` par la clé **service_role** :  
   **Settings → API → service_role** (secret, pas anon)  
4. **Run**

Vous devez voir 4 lignes :

```
edge_send_fcm_url
edge_send_fcm_token
edge_send_push_url
edge_send_push_token
```

---

## Étape 4 — APK / téléphone

1. Netlify : variables `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` → **prfmqfna** (déjà fait)  
2. **Clear cache and deploy** sur Netlify  
3. Sur le téléphone : ouvrir l’APK → se connecter → accepter **notifications**  
4. Vérifier dans SQL :

```sql
select user_id, left(token, 30), platform, created_at
from public.device_tokens
order by created_at desc;
```

→ au moins **1 ligne** pour votre compte.

---

## Étape 5 — Test

```sql
select public.notify_user(
  'VOTRE_USER_ID'::uuid,
  'Test Easy Dunya',
  'Comme l''ancien projet 📱',
  'test',
  '{}'::jsonb
);
```

→ notification dans la **barre Android** en quelques secondes.

Si rien : **Edge Functions → send-fcm → Logs** (erreur OAuth / JSON invalide = mauvais secret Firebase).

---

## Diagnostic rapide

Exécutez `supabase/scripts/diag_fcm_native.sql` dans le SQL Editor.

| Problème | Cause |
|----------|--------|
| `device_tokens` vide | Permission refusée sur le téléphone ou pas reconnecté |
| Pas de `edge_send_fcm_url` | Étape 3 SQL non faite |
| `send-fcm` log « FCM_SERVICE_ACCOUNT manquant » | Étape 2 |
| FCM 404 UNREGISTERED | Rebuild APK avec `GOOGLE_SERVICES_JSON` (GitHub secret) |

---

## Web push (navigateur, optionnel)

Pour le site web (pas l’APK), ajoutez aussi sur prfmqfna :

```
VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
VAPID_SUBJECT=mailto:contact@easydunya.app
```

Et sur Netlify : `VITE_VAPID_PUBLIC_KEY` = même clé publique VAPID.

L’APK utilise **FCM uniquement** — VAPID n’est pas requis pour la barre téléphone.
