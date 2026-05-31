# 🚐 Easy Dunya

> Plateforme digitale de transport interurbain en Mauritanie.
> Application installable (PWA) sur Android, iOS et Desktop.

Easy Dunya digitalise le système informel des garages mauritaniens sans le
remplacer : les passagers peuvent réserver à l'avance, suivre leur voyage en
temps réel, et payer en espèces à bord. Les chauffeurs publient leurs voyages,
reçoivent et gèrent les réservations, partagent leur position GPS.

## ✨ Stack technique

| Couche       | Technologies                                                         |
| ------------ | -------------------------------------------------------------------- |
| Frontend     | React 18 + TypeScript + Vite                                         |
| UI           | Tailwind CSS 3 (Inter / Cairo), Leaflet + OpenStreetMap              |
| i18n         | i18next + react-i18next (FR / AR avec support RTL)                   |
| PWA          | vite-plugin-pwa + Workbox (offline, install, cache cartes 7 jours)   |
| Backend      | Supabase self-hosted (PostgreSQL + Auth + Realtime + Storage)        |
| Sécurité     | Row Level Security PostgreSQL, JWT, bcrypt, HTTPS                    |
| Déploiement  | Docker (Coolify), Nginx + Traefik                                    |

## 🚀 Démarrage rapide

### 1. Pré-requis

- Node.js ≥ 20
- npm ≥ 10
- Docker Desktop (pour Supabase local)

### 2. Installation

```bash
npm install
cp .env.example .env
```

### 3. Démarrer Supabase en local

```bash
docker compose up -d
```

Puis appliquez les migrations dans Studio (http://localhost:3000) ou via psql :

```bash
docker exec -i easydunya-db psql -U postgres -d postgres < supabase/migrations/0001_init.sql
docker exec -i easydunya-db psql -U postgres -d postgres < supabase/seed.sql
```

| Service        | URL                       |
| -------------- | ------------------------- |
| Studio         | http://localhost:3000     |
| API REST/Auth  | http://localhost:8000     |
| PostgreSQL     | localhost:5432            |

### 4. Lancer le frontend

```bash
npm run dev
```

Ouvrez http://localhost:5173

### 5. Build de production

```bash
npm run build
npm run preview
```

## 👥 Comptes de test (créés par `seed.sql`)

| Rôle       | Email                  | Mot de passe |
| ---------- | ---------------------- | ------------ |
| Admin      | admin@easydunya.mr     | password123  |
| Chauffeur  | driver@easydunya.mr    | password123  |
| Passager   | passenger@easydunya.mr | password123  |

> Ces comptes sont créés par le seed SQL avec un mot de passe haché bcrypt.

## 🗺 Fonctionnalités MVP livrées

- [x] Page d'accueil avec carte interactive de la Mauritanie
- [x] Marqueurs colorés proportionnels au nombre de voyages par ville
- [x] Liste live des voyages programmés (7 prochains jours)
- [x] Inscription / connexion (passager + chauffeur, validation admin chauffeurs)
- [x] Réservation en invité (nom + téléphone) → code à 6 caractères
- [x] Réservation avec compte (historique)
- [x] Page "Vérifier ma réservation" via code
- [x] Dashboard chauffeur (mes voyages, mes véhicules, mes réservations)
- [x] Publication d'un voyage par le chauffeur
- [x] Confirmation / refus des réservations
- [x] Dashboard admin (validation chauffeurs, statistiques)
- [x] PWA installable + cache offline des tuiles OSM (7 jours)
- [x] Bilingue Français / Arabe avec RTL automatique
- [x] Design responsive mobile-first

## 🛣 Roadmap (post-MVP)

- [ ] Suivi GPS en direct via Supabase Realtime + WebSocket
- [ ] Notifications push natives (Web Push + VAPID + Edge Function Deno)
- [ ] Mobile Money (Bankily / Sedad / Masrvi)
- [ ] Notation des chauffeurs (UI)
- [ ] Codes promo / parrainage

## 📁 Structure du projet

```
.
├── docker-compose.yml          # Stack Supabase local complète
├── supabase/
│   ├── migrations/0001_init.sql   # Tables, RLS, triggers, vues
│   └── seed.sql                   # Villes + comptes de démo
├── src/
│   ├── lib/        # supabase client, types, cities, codes, utils
│   ├── hooks/      # useAuth, useTrips, useBookings
│   ├── components/ # Layout, MapView, TripCard, BookingForm, etc.
│   ├── pages/      # Home, Login, passenger/, driver/, admin/
│   └── locales/    # fr.json, ar.json
└── public/         # icons PWA, manifest, favicon
```

## 📜 Licence

© 2026 Easy Dunya — Adam Ba & Maimouna Dia
