# Démarrer Easy Dunya sans Docker

Si PowerShell affiche :

```text
docker : Le terme «docker» n'est pas reconnu...
```

c’est que **Docker Desktop n’est pas installé** (ou pas dans le PATH). Vous pouvez quand même lancer l’application avec **Supabase Cloud** (gratuit) — aucun Docker requis.

---

## Étape 1 — Node.js

1. Téléchargez **Node.js LTS** : https://nodejs.org/
2. Installez-le, **fermez puis rouvrez** PowerShell.
3. Vérifiez :

```powershell
node --version
npm --version
```

---

## Étape 2 — Frontend

```powershell
cd C:\Projets\EASYDUNYA1
copy .env.example .env
npm install
```

Ne lancez pas encore `npm run dev` (il faut d’abord configurer Supabase).

---

## Étape 3 — Projet Supabase Cloud

1. Créez un compte sur https://supabase.com
2. **New project** → choisissez un nom (ex. `easy-dunya`), un mot de passe base de données, une région proche.
3. Attendez la fin du provisionnement (~2 min).

### Récupérer les clés API

Dans le dashboard : **Project Settings** → **API**

| Champ | Variable `.env` |
|-------|-----------------|
| Project URL | `VITE_SUPABASE_URL` |
| `anon` `public` key | `VITE_SUPABASE_ANON_KEY` |

Éditez `C:\Projets\EASYDUNYA1\.env` :

```env
VITE_SUPABASE_URL=https://VOTRE_REF.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_DEFAULT_LOCALE=fr
```

---

## Étape 4 — Créer les tables (SQL)

1. Dashboard Supabase → **SQL Editor** → **New query**
2. Copiez-collez **tout** le fichier :
   `C:\Projets\EASYDUNYA1\supabase\migrations\0001_init.sql`
3. Cliquez **Run**.

Si vous voyez une erreur du type *« relation already exists »* sur la publication Realtime, ignorez-la ou commentez ces 3 lignes en bas du fichier :

```sql
-- alter publication supabase_realtime add table public.bookings;
-- alter publication supabase_realtime add table public.trips;
-- alter publication supabase_realtime add table public.driver_positions;
```

4. Nouvelle requête → copiez-collez **uniquement** la partie **VILLES** de `supabase/seed.sql` (le bloc `insert into public.cities`) → **Run**.

---

## Étape 5 — Comptes de test (Auth)

Sur Supabase Cloud, ne pas insérer directement dans `auth.users` via SQL (souvent bloqué). Créez les utilisateurs à la main :

**Authentication** → **Users** → **Add user** → **Create new user**

| Email | Mot de passe | Rôle (à mettre dans le profil après) |
|-------|--------------|--------------------------------------|
| admin@easydunya.mr | password123 | admin |
| driver@easydunya.mr | password123 | driver |
| passenger@easydunya.mr | password123 | passenger |

Cochez **Auto Confirm User** pour chaque compte.

Puis **SQL Editor** — pour chaque utilisateur, récupérez son `id` dans Authentication → Users, et exécutez (remplacez `UUID_ICI`) :

```sql
-- Admin
update public.profiles
   set role = 'admin', full_name = 'Admin Easy Dunya', phone = '+22230000001'
 where id = 'UUID_ADMIN';

-- Chauffeur approuvé
update public.profiles
   set role = 'driver', driver_status = 'approved',
       full_name = 'Mohamed Ould Sidi', phone = '+22230000002'
 where id = 'UUID_DRIVER';

-- Passager
update public.profiles
   set role = 'passenger', full_name = 'Aminata Diallo', phone = '+22230000003'
 where id = 'UUID_PASSENGER';
```

> Le trigger `handle_new_user` crée déjà une ligne dans `profiles` à l’inscription ; ces `UPDATE` fixent le rôle.

### Voyages de démo (optionnel)

Après avoir créé le chauffeur et un véhicule dans l’app (ou via SQL), vous pouvez publier des voyages depuis **Espace chauffeur** dans l’interface.

---

## Étape 6 — Lancer l’app

```powershell
cd C:\Projets\EASYDUNYA1
npm run dev
```

Ouvrez **http://localhost:5173**

---

## Plus tard : installer Docker (optionnel)

Si vous voulez Supabase **en local** comme dans le README :

1. https://www.docker.com/products/docker-desktop/
2. Installez **Docker Desktop for Windows**
3. Redémarrez le PC si demandé
4. Ouvrez Docker Desktop (icône baleine dans la barre des tâches)
5. Puis :

```powershell
cd C:\Projets\EASYDUNYA1
docker compose up -d
```

Remettez dans `.env` :

```env
VITE_SUPABASE_URL=http://localhost:8000
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlLWRlbW8iLCJpYXQiOjE2NDE3NjkyMDAsImV4cCI6MTc5OTUzNTYwMH0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE
```

---

## Résumé

| Méthode | Docker requis ? |
|---------|-----------------|
| Supabase Cloud (ce guide) | Non |
| `docker compose up -d` (README) | Oui — Docker Desktop |
