# Toutes les étapes — Easy Dunya sur l’App Store

## Réponse courte

**Oui : vous n’avez pas besoin de votre Mac 2017** pour Archive / TestFlight / App Store.

Il faut un **Mac dans le cloud** (Xcode 26 + SDK iOS 26), pas un Linux. Le workflow Android GitHub (`ubuntu-latest`) **ne produit pas** d’IPA. Codemagic et GitHub Actions `macos-26` louent un Mac Apple silicon le temps du build.

Ce qui reste obligatoire (navigateur, pas Xcode) :

| Porte | À quoi ça sert | Sans ça |
| --- | --- | --- |
| Apple Developer **99 $/an** | Droit d’envoyer l’app, créer certificats, TestFlight | Personal Team = **interdit** d’uploader |
| Clé API App Store Connect (fichier `.p8`) | Le cloud signe et envoie à la place de Xcode | Le build cloud échoue à la signature |
| **Xcode 26** sur le Mac cloud | Apple refuse tout binaire plus ancien depuis le **28 avril 2026** | Votre Xcode **15.2** local serait refusé |

Votre MacBook Pro 13" 2017 / Ventura 13 ne peut **pas** installer Sequoia ni Xcode 26. Il reste utile seulement pour tester l’app en câble. L’upload Store passe par le cloud.

Ne **pas** utiliser PWABuilder, Xcode Cloud (le 1er réglage demande souvent un Mac), ni `npm run cap:ios` pour le cloud (`cap:ios` enlève des plugins pour Xcode 15.2).

---

## Ordre à suivre (ne pas sauter)

1. Payer les **99 $** Apple Developer  
2. Créer l’identifiant `app.easydunya` + la fiche App Store Connect  
3. Créer la **clé API** `.p8` (navigateur)  
4. Déployer `delete-own-account` (Terminal)  
5. Page `/confidentialite` en ligne (Netlify)  
6. Build cloud → TestFlight (**Codemagic** recommandé, ou GitHub Actions)  
7. Tester sur l’iPhone via TestFlight, puis **Soumettre** à Apple  

---

### Étape 1 — Payer 99 $ (Apple Developer Program)

Sans cet abonnement, aucun cloud ne peut uploader.

1. Ouvrez [https://developer.apple.com/programs/enroll/](https://developer.apple.com/programs/enroll/) **avec le même Apple ID** que Xcode (Rakky Bah).
2. Enroll as **Individual** (personne physique).
3. Carte bancaire, **99 USD / an**.
4. Attendre l’e-mail « Welcome to the Apple Developer Program » (souvent quelques heures, parfois 24–48 h).
5. Vérifiez : [https://developer.apple.com/account](https://developer.apple.com/account) affiche **Program** / membership **Active**, plus seulement « Personal Team ».

Notez le **Team ID** (10 caractères, Membership details). Il servira de secret `APPLE_TEAM_ID`.

---

### Étape 2 — Identifiant + fiche App Store Connect

1. [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/identifiers/list) → **+** → App IDs → App.
2. Description : Easy Dunya. Bundle ID **Explicit** : `app.easydunya`.
3. **Ne pas** cocher Push Notifications ni Background Modes.
4. [https://appstoreconnect.apple.com](https://appstoreconnect.apple.com) → **Apps** → **+** → **Nouvelle app**.
5. Plateforme **iOS**. Nom : **Easy Dunya**. Langue principale : français. Bundle ID : `app.easydunya`. SKU : `easydunya-ios`.
6. Catégorie : **Voyages / Travel**. Prix : gratuit. Âge : **4+**.
7. Chiffrement : **Non** (HTTPS seulement).
8. Privacy Policy : `https://easydunya.netlify.app/confidentialite`  
   Support : `https://easydunya.netlify.app/a-propos`
9. Confidentialité (nutrition labels) :
   - Nom, téléphone, localisation précise + approximative, interactions produit
   - Liées au compte, **pas** de tracking pub, finalité **fonctionnalité de l’app**
   - Localisation : **lorsque l’app est utilisée**, pas en arrière-plan
10. Captures **iPhone 6.7"** et **6.1"** (recherche, voyage, réservation, profil). Pas de cadre Android, pas de « build 22 ».
11. **Compte démo** (obligatoire) — créez un vrai passager **avant** de soumettre, puis dans **Notes de révision** :

```
Compte démo passager
Téléphone : <le numéro>
Mot de passe : <le mot de passe>

Connexion par téléphone + mot de passe (pas Sign in with Apple).
Autoriser la position « Lorsque l’app est active ».
Notifications iOS locales (pas de push si l’app est tuée).
Suppression de compte : Profil → Supprimer mon compte.
```

Ne mettez **pas** le mot de passe admin dans ces notes.

Notez aussi l’**Apple ID** numérique de l’app (App Store Connect → l’app → App Information). Utile pour Codemagic (`APP_STORE_APPLE_ID`).

---

### Étape 3 — Clé API App Store Connect (navigateur, 1 fois)

C’est ce qui remplace Xcode sur votre bureau.

1. Connectez-vous : [Users and Access → Integrations → App Store Connect API](https://appstoreconnect.apple.com/access/integrations/api)
2. **+** → nom `EasyDunyaCloud` → accès **Admin** ou **App Manager**.
3. **Download API Key** : fichier `AuthKey_XXXXXXXXXX.p8` — **une seule fois**. Gardez-le.
4. Notez **Issuer ID** (UUID en haut de la page) et **Key ID** (10 caractères).

Ne commitez jamais le `.p8` dans Git.

---

### Étape 4 — Fonction suppression de compte (Terminal, pas SQL)

Sans ça, **Profil → Supprimer mon compte** échoue → Apple rejette (règle 5.1.1v).

```bash
cd ~/chemin/vers/easydunya
npx supabase login
git fetch origin
git checkout origin/main -- supabase/functions/delete-own-account
npx supabase functions deploy delete-own-account --project-ref prfmqfnaqtmyfyxqjeli
```

Collez **une commande à la fois**. Pas dans l’éditeur SQL Supabase.

Si `git checkout main` est refusé à cause de `project.pbxproj` / `Info.plist` : ne changez **pas** de branche. La commande `git checkout origin/main -- supabase/functions/delete-own-account` copie seulement ce dossier.

---

### Étape 5 — Page confidentialité en ligne (Netlify)

Apple exige une **URL publique** sans login.

Aujourd’hui il faut que `main` ait le texte (PR iOS Store fusionnée), puis ouvrir dans Safari : le titre **Politique de confidentialité** doit apparaître.

| Champ | URL |
| --- | --- |
| Privacy Policy | https://easydunya.netlify.app/confidentialite |
| Support | https://easydunya.netlify.app/a-propos |
| Marketing (optionnel) | https://easydunya.netlify.app |

---

### Étape 6 — Build cloud (recommandé : Codemagic)

Codemagic crée le certificat Distribution **sans Mac** (Generate certificate). GitHub Actions peut aussi signer tout seul avec la clé `.p8`.

#### 6a. Codemagic (le plus simple sans Mac)

1. Compte : [https://codemagic.io/start](https://codemagic.io/start) → Sign in with GitHub → autoriser `mounaStart/easydunya`.
2. Applications → **Add application** → GitHub → `easydunya`. Type : Ionic Capacitor.  
   **Check for configuration file** sur la branche `cursor/ios-cloud-appstore-0cb8` (fichier `codemagic.yaml`).
3. Team settings → **Team integrations → Developer Portal → Manage keys** → Add key :
   - Name : **`easydunya`** (doit matcher `codemagic.yaml`)
   - Issuer ID + Key ID de l’étape 3
   - Upload du `.p8`
4. Team settings → **codemagic.yaml settings → Code signing identities → iOS certificates** → **Generate certificate** :
   - Type : **Apple Distribution**
   - API key : easydunya
5. Sur [developer.apple.com Profiles](https://developer.apple.com/account/resources/profiles/list) → **+** → **App Store Connect** → App ID `app.easydunya` → le certificat Distribution que Codemagic vient de créer → Download n’est pas obligatoire : dans Codemagic, **iOS provisioning profiles → Fetch profiles**, sélectionnez le profil App Store, reference name libre.
6. Variables d’environnement (group **`easydunya_vite`**, cocher Secret) :

   | Variable | Valeur |
   | --- | --- |
   | `VITE_SUPABASE_URL` | `https://prfmqfnaqtmyfyxqjeli.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | clé anon Supabase |
   | `VITE_GOOGLE_MAPS_API_KEY` | clé Maps |
   | `VITE_VAPID_PUBLIC_KEY` | optionnel |
   | `APP_STORE_APPLE_ID` | ID numérique de l’étape 2 |

7. **Start new build** → workflow **iOS App Store**. Attendre 15–25 min.
8. Si vert : l’IPA est sur **TestFlight**. Pas encore en revue Apple.

Le 1er mois Codemagic offre des minutes Mac. Au-delà, un forfait pay-as-you-go (quelques dollars par build) suffit.

#### 6b. Alternative : GitHub Actions (Mac `macos-26`, déjà dans le dépôt)

Le repo public `easydunya` peut lancer un runner **macos-26** (Xcode 26). Ce n’est **pas** le workflow Android Ubuntu.

1. GitHub → `mounaStart/easydunya` → **Settings → Secrets and variables → Actions** → New repository secret :

   | Secret | Valeur |
   | --- | --- |
   | `APP_STORE_CONNECT_KEY_ID` | Key ID (10 caractères) |
   | `APP_STORE_CONNECT_ISSUER_ID` | Issuer ID (UUID) |
   | `APP_STORE_CONNECT_PRIVATE_KEY` | contenu entier du `.p8` (y compris `BEGIN PRIVATE KEY`) |
   | `APPLE_TEAM_ID` | Team ID 10 caractères |
   | `VITE_SUPABASE_ANON_KEY` | déjà utilisé pour l’AAB Android si présent |
   | `VITE_GOOGLE_MAPS_API_KEY` | idem |
   | `VITE_VAPID_PUBLIC_KEY` | optionnel |

2. Onglet **Actions** → **Build iOS IPA** → **Run workflow**.
3. Branche : `cursor/ios-cloud-appstore-0cb8` (ou `cursor/ios-app-store-ready-0cb8` une fois fusionné).
4. `upload_to_testflight` : coché.
5. Attendre le job vert, puis Connect → TestFlight.

Signature : Xcode sur le runner crée certificat + profil via `-allowProvisioningUpdates` (équipe payante). Ne pas ajouter Push.

Artifact `EasyDunya-ipa` = copie de l’IPA. L’upload TestFlight est déjà fait si l’étape « Envoyer vers TestFlight » est verte.

---

### Étape 7 — TestFlight puis revue Apple

1. App Store Connect → l’app → **TestFlight**. Attendre « Ready to Test » (5–30 min, parfois plus au 1er build : traitement du compte).
2. Installer **TestFlight** sur l’iPhone (App Store), tester : connexion, recherche, profil, suppression sur un **compte jetable**.
3. Connect → version **1.1.0** → Build 23 (ou plus) → **Ajouter pour révision** → **Soumettre**.
4. Délai Apple souvent 24–48 h, parfois une semaine.

Chaque nouvel upload : augmenter seulement le **Build** (23 → 24 → 25), garder 1.1.0 tant que c’est la même version Store. Codemagic incrémente tout seul si `APP_STORE_APPLE_ID` est renseigné.

---

## Ce que le code a déjà corrigé (vous n’avez rien à recoder)

| Risque Apple | Statut |
| --- | --- |
| Tampons debug « iOS build 22 » / nom **ED 22** | Retirés. Nom **Easy Dunya**. Version **1.1.0** (23). |
| Pas de suppression de compte (5.1.1v) | **Profil → Supprimer mon compte** |
| `PrivacyInfo.xcprivacy` | Inclus |
| Localisation « Toujours » | Seulement **lorsque l’app est active** |
| Chiffrement | `ITSAppUsesNonExemptEncryption = false` |
| Sign in with Apple | Non exigé (téléphone + mot de passe) |
| Push / APNs | Entitlements vides. Ne pas ajouter Push pour la 1re version |

Contrôle local : `npm run ios:store-check`  
Build cloud (Xcode 26, plugins complets) : `npm run cap:ios:cloud`  
Build Mac 2017 / Xcode 15.2 (test câble seulement) : `npm run cap:ios`

---

## Ce que le cloud ne remplace pas

- Les **99 $** Apple.
- La **fiche** App Store Connect (captures, confidentialité, compte démo) — tout ça se fait dans le navigateur.
- Un **iPhone** pour tester TestFlight.
- Votre Mac 2017 pour un test USB si vous voulez, **pas** pour l’upload.

Xcode Cloud (Apple) : le premier workflow se configure souvent **depuis Xcode** → inutile ici. Codemagic / GitHub Actions `macos-26` n’ont pas besoin d’ouvrir Xcode chez vous.

---

## Annexe — si vous achetez un Mac plus tard

Xcode 26 demande au minimum **macOS Sequoia 15.6**, donc un Mac **Apple silicon (M1+)** ou Intel 2018+. Commandes locales : voir [`BUILD-IPA.md`](BUILD-IPA.md). Ce n’est **pas** requis tant que le cloud envoie TestFlight.

---

## Description Store (à coller / adapter)

Easy Dunya met en relation passagers et chauffeurs pour des voyages
entre villes en Mauritanie : recherche, réservation, suivi GPS pendant
le trajet, notifications de réservation.

Ne **pas** écrire « push en arrière-plan ». Ne pas promettre une
fonction absente de l’app.
