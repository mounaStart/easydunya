# Migrer Easy Dunya vers votre projet Supabase

**Projet cible :** [prfmqfnaqtmyfyxqjeli](https://supabase.com/dashboard/project/prfmqfnaqtmyfyxqjeli)

---

## Pourquoi vous ne voyez pas `pqljcsnsyvacobdmpqgn`

| Projet | Visible chez vous ? | Rôle actuel |
|--------|---------------------|-------------|
| `pqljcsnsyvacobdmpqgn` | **Non** (autre organisation) | Base de **easydunya.netlify.app** |
| `prfmqfnaqtmyfyxqjeli` | **Oui** | Votre projet (vide / incomplet) |
| `ddsitsqcrsrbkaetmmhm` | **Oui** | 2ᵉ projet perso |

**Solution :** recréer le schéma Easy Dunya sur `prfmqfnaqtmyfyxqjeli`, puis **pointer Netlify** vers ce projet.

> **Données utilisateurs / réservations de l’ancienne base :** sans accès au dashboard `pqljcsns…`, vous **ne pouvez pas** copier les comptes existants automatiquement. Il faudra recréer les comptes (ou les inviter à se réinscrire).

---

## Étape 0 — Reset (si erreur `full_name does not exist`)

Une ancienne tentative a laissé des **tables incomplètes**. Ce n'est **pas** un changement de nom de colonne.

1. SQL Editor → exécuter **`supabase/scripts/reset_public_before_migrate.sql`**
2. Résultat attendu : `tables_public_restantes = (vide — OK …)`

Puis seulement :

## Étape 1 — Schéma complet (SQL)

### Option A — Un seul fichier (recommandé)

1. Ouvrez le fichier :  
   `supabase/scripts/bootstrap_prfmqfna_ALL_MIGRATIONS.sql`
2. Supabase → **SQL Editor** → New query
3. Collez **tout** le fichier → **Run**

Si timeout, exécutez **par blocs** (0001 seul, puis 0002–0008, etc.).

### Option B — Fichier par fichier

Dans l’ordre, dans `supabase/migrations/` :

```
0001_init.sql → 0002 → … → 0025_welcome_first_booking_notifications.sql
```

---

## Étape 2 — Données de base (villes)

1. SQL Editor → ouvrir `supabase/seed.sql`
2. Exécuter **uniquement** le bloc `insert into public.cities` (lignes 7–21)
3. **Ne pas** exécuter les `insert into auth.users` (interdit sur Supabase Cloud)

---

## Étape 3 — Compte admin

1. **Authentication** → **Providers** → **Email** → **Activé**
2. **Authentication** → **Users** → **Add user** :
   - Email : `20986280@phone.easydunya.app`
   - Password : `password1234`
   - ✓ Auto Confirm User
3. SQL Editor → exécuter `supabase/scripts/setup_mounastart_admin.sql`

---

## Étape 4 — Clés API (important pour Netlify)

1. **Project Settings** → **API**
2. Notez :
   - **Project URL** : `https://prfmqfnaqtmyfyxqjeli.supabase.co`
   - **anon public** key (commence souvent par `sb_publishable_…` ou `eyJ…`)

---

## Étape 5 — Pointer Netlify vers le NOUVEAU projet

1. [Netlify](https://app.netlify.com/) → site **easydunya**
2. **Site configuration** → **Environment variables**
3. Modifier :

| Variable | Nouvelle valeur |
|----------|-----------------|
| `VITE_SUPABASE_URL` | `https://prfmqfnaqtmyfyxqjeli.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | clé anon du projet prfmqfna… |

4. **Deploys** → **Trigger deploy** → **Clear cache and deploy site**

---

## Étape 6 — GitHub Actions (APK)

**Settings** → **Secrets** → mettre à jour :

| Secret | Valeur |
|--------|--------|
| `VITE_SUPABASE_ANON_KEY` | clé anon prfmqfna… |

Dans `.github/workflows/android.yml`, la ligne `VITE_SUPABASE_URL` doit aussi pointer vers `prfmqfnaqtmyfyxqjeli` (à modifier dans le code si besoin).

Relancer **Build Android APK** et réinstaller l’APK.

---

## Étape 7 — Fichier `.env` local

```env
VITE_SUPABASE_URL=https://prfmqfnaqtmyfyxqjeli.supabase.co
VITE_SUPABASE_ANON_KEY=votre_clé_anon
VITE_DEFAULT_LOCALE=fr
```

---

## Étape 8 — Notifications (optionnel mais recommandé)

1. SQL Editor → `supabase/scripts/diag_notifications_realtime.sql` (partie réparation)
2. SQL Editor → `supabase/scripts/apply_0025_notifications.sql`
3. Déployer Edge Functions `send-push` et `send-fcm` (Supabase CLI ou Dashboard)
4. `supabase/scripts/setup_push.sql` + config FCM (voir diag_fcm_native.sql)

---

## Étape 9 — Vérification

```sql
-- Tables principales
select tablename from pg_tables
where schemaname = 'public'
  and tablename in ('profiles','cities','trips','bookings','notifications','device_tokens')
order by tablename;

-- Villes
select count(*) from public.cities;

-- Admin
select email, p.role from auth.users u
join public.profiles p on p.id = u.id
where u.email = '20986280@phone.easydunya.app';
```

Puis tester : https://easydunya.netlify.app/login avec `20986280` / `password1234`

---

## Résumé

```
prfmqfna…  ←  migrations 0001–0025 + seed villes + admin
     ↓
Netlify    ←  nouvelles variables d'environnement
     ↓
GitHub     ←  secret VITE_SUPABASE_ANON_KEY + rebuild APK
     ↓
Téléphone  ←  nouvel APK + réinscription utilisateurs si besoin
```
