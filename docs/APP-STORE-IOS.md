# Soumettre Easy Dunya sur l’App Store (iOS)

Ce document est la checklist **rejet Apple**. L’archive se fait uniquement
sur un **Mac**. Linux / Cloud Agent préparent le projet, pas l’IPA.

Procédure Xcode (ouvrir, signer, Archive) : [`BUILD-IPA.md`](BUILD-IPA.md).

---

## Ce qui ferait rejeter l’app (déjà corrigé dans le code)

| Risque Apple | Statut dans ce dépôt |
| --- | --- |
| Tampons debug « iOS build 22 » / nom d’icône **ED 22** | Retirés. Nom sous l’icône : **Easy Dunya**. Version **1.1.0** (build **23**). |
| Guideline **5.1.1(v)** — pas de suppression de compte in-app | **Profil → Supprimer mon compte** (confirmation + case à cocher). |
| Manifeste de confidentialité `PrivacyInfo.xcprivacy` | Inclus dans la cible Xcode. Pas de tracking publicitaire. |
| Localisation « Toujours » sans mode arrière-plan | Seule la clé **Lorsque l’app est active** reste. Le plugin ne demande pas Always. |
| `ITSAppUsesNonExemptEncryption` | `false` (HTTPS = exemption). Répondre **Non** à l’export compliance. |
| Sign in with Apple | **Non exigé** : connexion téléphone / mot de passe, pas Facebook/Google. |
| Capability Push vide / entitlements `aps-environment` | Entitlements **vides** exprès. Ne **pas** ajouter Push pour la 1re soumission (Xcode 15.2 ne compile pas le plugin ; Personal Team n’a pas APNs). Notifications iOS = **locales** tant que l’app tourne. |

Contrôle local :

```bash
npm run ios:store-check
```

---

## Bloquants que le code ne peut pas lever

### 1. Compte Apple Developer payant (99 $/an)

Un **Personal Team** (gratuit) **ne peut pas** envoyer de binaire sur
App Store Connect / TestFlight. Dans Xcode → Signing : l’équipe doit
être l’équipe **payante**, bundle **`app.easydunya`**.

Si l’iPhone de test utilise encore `app.easydunya.rakky`, ce n’est **pas**
le binaire Store. Pour la soumission : Team payante + `app.easydunya`.

### 2. Xcode 26 + SDK iOS 26 (depuis le 28 avril 2026)

Apple **refuse l’upload** d’un IPA compilé avec Xcode 15.2.
Il faut **Xcode 26** (SDK iOS 26) sur un Mac récent
(macOS Sequoia 15 ou plus). macOS 13 + Xcode 15.2 = tests locaux seulement.

Capacitor 8.5 est compatible Xcode 26. **Ne pas** lancer
`npx cap migrate` (UIScene) tant que vous archivez avec Xcode 26 :
ce migrate est pour Xcode 27.

### 3. Edge function de suppression

Dans le **Terminal** (pas l’éditeur SQL) :

```bash
npx supabase functions deploy delete-own-account --project-ref prfmqfnaqtmyfyxqjeli
```

Sans ce déploiement, le bouton Profil échoue → rejet 5.1.1(v).

### 4. URLs publiques (App Store Connect)

À coller dans la fiche app. Elles doivent répondre **sans login** après
déploiement Netlify (`main`) :

| Champ Connect | URL |
| --- | --- |
| Privacy Policy | `https://easydunya.netlify.app/confidentialite` |
| Support | `https://easydunya.netlify.app/a-propos` |
| Marketing (optionnel) | `https://easydunya.netlify.app` |

Dans l’app iOS embarquée, les mêmes pages existent déjà
(`/confidentialite`, `/cgu`).

---

## Fiche App Store Connect

1. [developer.apple.com/account](https://developer.apple.com/account) →
   Programme payant actif.
2. [appstoreconnect.apple.com](https://appstoreconnect.apple.com) →
   **Mes apps** → **+** → iOS.
3. Nom : **Easy Dunya** (sous-titre court, ex. Voyages en Mauritanie).
4. Bundle ID : `app.easydunya` (créer l’identifiant dans
   Certificates, Identifiers & Profiles s’il n’existe pas encore
   **sur le compte payant**).
5. SKU interne libre (ex. `easydunya-ios`).
6. Catégorie : **Travel** (Voyages).
7. Âge : **4+** (pas de contenu adulte, pas de UGC non modéré comme réseau social).
8. Prix : gratuit (achats in-app : aucun).
9. Chiffrement : **Non** (HTTPS uniquement).
10. Données de confidentialité (nutrition labels) — alignées sur le manifeste :

    - Nom, numéro de téléphone, localisation précise et approximative,
      interactions produit : liées au compte, **pas** utilisées pour le
      tracking, finalité **fonctionnalité de l’app**.
    - Pas d’identifiant publicitaire.

11. Localisation : **Lorsque l’app est utilisée**, pas en arrière-plan.
12. Compte : création + **suppression dans Profil**.

### Comptes démo pour l’équipe Review (obligatoire)

Dans **Notes de révision**, donner au moins :

- un **passager** (téléphone + mot de passe) ;
- un **chauffeur approuvé** avec au moins un voyage à venir, si vous
  voulez qu’ils testent le GPS chauffeur.

Créer ces comptes vous-même **avant** de cliquer Soumettre.
Ne pas mettre de vrais mots de passe admin dans les notes si possible
(un passager suffit souvent ; le chauffeur aide).

Indiquer :

- autoriser **la position lorsque l’app est active** au premier lancement ;
- les notifications iOS sont locales (pas de bannière si l’app est tuée) ;
- pas de Sign in with Apple (connexion téléphone).

### Captures d’écran

iPhone 6.7" **et** 6.1" (obligatoires). Pas de cadre Android.
Pas de tampon « build 22 ». Texte réel de l’app (recherche, voyage,
réservation, profil).

---

## Sur le Mac — produire le binaire Store

```bash
git fetch origin
git checkout cursor/ios-app-store-ready-0cb8
git pull
npm ci
npm run ios:store-check
npm run cap:ios
```

`cap:ios` doit afficher : `OK — Xcode a le JS embarqué App Store : easydunya-ios-store`.

Puis Xcode :

1. Ouvrir `ios/App/App.xcodeproj`.
2. Signing : **équipe payante**, bundle `app.easydunya`, Automatic.
3. **Ne pas** ajouter Push Notifications ni Background Modes.
4. Destination : **Any iOS Device (arm64)**.
5. Product → Clean, puis **Product → Archive**.
6. Organizer → **Distribute App** → **App Store Connect** → Upload.
7. TestFlight : installer, parcourir login / recherche / profil /
   suppression (sur un compte jetable).
8. Connect → version 1.1.0 → Soumettre pour review.

Incrémentez **Build** (23 → 24…) à chaque nouvel upload TestFlight,
sans forcément changer 1.1.0.

---

## Description (aide, à coller / adapter)

Easy Dunya met en relation passagers et chauffeurs pour des voyages
entre villes en Mauritanie : recherche, réservation, suivi GPS pendant
le trajet, notifications de réservation.

Ne **pas** écrire « push en arrière-plan » tant que APNs n’est pas
branché. Ne pas promettre de fonctionnalités absentes.
