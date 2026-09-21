# Toutes les étapes — Easy Dunya sur l’App Store

## Réponse courte

**Payer 99 $ ne suffit pas** avec le Xcode actuel.

Ce sont **deux portes différentes** :

| Porte | À quoi ça sert | Votre machine aujourd’hui |
| --- | --- | --- |
| Apple Developer **99 $/an** | Droit d’envoyer l’app sur App Store Connect / TestFlight | Personal Team = **interdit** d’uploader |
| **Xcode 26** + SDK **iOS 26** | Outil qu’Apple accepte pour l’upload depuis le **28 avril 2026** | Xcode **15.2** + macOS **13** = **refusé** à l’upload |

Avec Xcode 15.2 vous pouvez encore **tester sur l’iPhone en câble**.  
Vous **ne pouvez pas** mettre en production / TestFlight tant que le Mac n’a pas Xcode 26.

Xcode 26 **ne s’installe pas** sur macOS 13. Il faut au minimum **macOS Sequoia 15.6**, puis Xcode **26.0 à 26.3** (la dernière qui tourne encore sur Sequoia). Les Xcode 26.4+ demandent souvent macOS Tahoe.

---

## Ordre à suivre (ne pas sauter)

1. Vérifier si le Mac peut passer à Sequoia  
2. Payer les 99 $  
3. Mettre à jour macOS, puis installer Xcode 26  
4. Déployer la fonction `delete-own-account` (Terminal)  
5. Fusionner le code pour que Netlify ait `/confidentialite`  
6. Créer l’app dans App Store Connect (politique, support, compte démo)  
7. Sur le Mac : `cap:ios` + Archive + Upload  
8. TestFlight, puis Soumettre à Apple  

---

### Étape 1 — Le Mac peut-il installer Sequoia ?

Menu pomme → **À propos de ce Mac**.

- Année / modèle (ex. MacBook Air 2020, Mac mini M1…)
- macOS actuel : **Ventura 13** chez vous

Sequoia 15.6 tourne en général sur :

- tout Mac **Apple silicon** (M1 / M2 / M3 / M4)
- Intel **2018 ou plus récent** (selon le modèle)

[Liste officielle Sequoia](https://support.apple.com/en-us/120282)

- **Oui, le Mac est dans la liste** → passez à l’étape 2, puis 3.  
- **Non** → les 99 $ ne débloquent rien sur cette machine. Il faut un Mac compatible (ou un Mac d’emprunt) pour l’Archive.

---

### Étape 2 — Payer 99 $ (Apple Developer Program)

1. Ouvrez [https://developer.apple.com/programs/enroll/](https://developer.apple.com/programs/enroll/) **avec le même Apple ID** que Xcode (Rakky Bah).
2. Enroll as **Individual** (personne physique).
3. Carte bancaire, **99 USD / an**.
4. Attendre l’e-mail « Welcome to the Apple Developer Program » (souvent quelques heures, parfois 24–48 h).
5. Vérifiez : [https://developer.apple.com/account](https://developer.apple.com/account) affiche **Program** / membership **Active**, plus seulement « Personal Team ».

Sans cet e-mail, Xcode n’aura pas l’équipe payante et l’upload restera bloqué.

---

### Étape 3 — macOS Sequoia puis Xcode 26

**3a. Sauvegarder** (Time Machine ou copie).

**3b. Réglages → Général → Mise à jour de logiciels**

Monter autant que le Mac le permet :

Ventura 13 → Sonoma 14 (si proposé) → **Sequoia 15.6 ou plus**.

**3c. Installer Xcode 26**

- App Store → chercher **Xcode** : si la version proposée exige Tahoe et que vous êtes encore sur Sequoia, **ne pas** prendre Xcode 26.4+.
- À la place : [https://developer.apple.com/download/all/](https://developer.apple.com/download/all/) (Apple ID payant) → télécharger **Xcode 26.3** (SDK iOS 26, compatible Sequoia 15.6).
- Installer, ouvrir Xcode une fois, accepter la licence.

**3d. Vérifier dans Terminal**

```bash
xcodebuild -version
```

Il faut voir **Xcode 26.**x et un SDK **iOS 26**.  
S’il affiche encore 15.2 : Xcode 26 n’est pas l’app ouverte / sélectionnée.

---

### Étape 4 — Fonction suppression de compte (Terminal, pas SQL)

Sur le Mac, une fois (et après chaque changement de cette fonction) :

```bash
cd ~/chemin/vers/easydunya
npx supabase login
npx supabase functions deploy delete-own-account --project-ref prfmqfnaqtmyfyxqjeli
```

Collez **une commande à la fois**. Pas dans l’éditeur SQL Supabase.

Sans ça, **Profil → Supprimer mon compte** échoue → Apple rejette (règle 5.1.1v).

---

### Étape 5 — Page confidentialité en ligne (Netlify)

Apple exige une **URL publique** sans login.

Aujourd’hui `https://easydunya.netlify.app/confidentialite` n’a pas encore ce texte : il faut **merger** la branche App Store jusqu’à `main` (PR iOS + PR Store), attendre le déploiement Netlify, puis ouvrir l’URL dans Safari : le titre **Politique de confidentialité** doit apparaître.

URLs à coller plus tard dans Connect :

| Champ | URL |
| --- | --- |
| Privacy Policy | https://easydunya.netlify.app/confidentialite |
| Support | https://easydunya.netlify.app/a-propos |
| Marketing (optionnel) | https://easydunya.netlify.app |

---

### Étape 6 — Fiche App Store Connect (avant ou pendant l’upload)

1. [https://appstoreconnect.apple.com](https://appstoreconnect.apple.com) → **Apps** → **+** → **Nouvelle app**.
2. Plateforme **iOS**. Nom : **Easy Dunya**. Langue principale : français.
3. Bundle ID : créer `app.easydunya` dans  
   [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/identifiers/list)  
   si absent **sur le compte payant**. SKU libre : `easydunya-ios`.
4. Catégorie : **Voyages / Travel**. Prix : gratuit. Âge : **4+**.
5. Chiffrement : **Non** (HTTPS seulement).
6. Privacy Policy + Support = les URLs de l’étape 5.
7. Confidentialité (nutrition labels) :
   - Nom, téléphone, localisation précise + approximative, interactions produit
   - Liées au compte, **pas** de tracking pub, finalité **fonctionnalité de l’app**
   - Localisation : **lorsque l’app est utilisée**, pas en arrière-plan
8. Captures **iPhone 6.7"** et **6.1"** (recherche, voyage, réservation, profil). Pas de cadre Android, pas de « build 22 ».
9. **Compte démo** (obligatoire) — créez un vrai passager dans l’app **avant** de soumettre, puis dans **Notes de révision** :

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

---

### Étape 7 — Compiler et envoyer le binaire (Mac + Xcode 26)

```bash
cd ~/chemin/vers/easydunya
git fetch origin
git checkout cursor/ios-app-store-ready-0cb8
git pull
npm ci
npm run ios:store-check
npm run cap:ios
```

La dernière ligne doit être :

`OK — Xcode a le JS embarqué App Store : easydunya-ios-store`

Puis Xcode :

1. Ouvrir `ios/App/App.xcodeproj` (pas un `.xcworkspace`).
2. Cible **App** → **Signing & Capabilities** :
   - Automatically manage signing
   - **Team = l’équipe payante** (plus Personal Team)
   - Bundle Identifier = `app.easydunya`  
     (pas `app.easydunya.rakky` — c’était le test Personal Team)
3. **Ne pas** ajouter Push Notifications ni Background Modes.
4. Destination : **Any iOS Device (arm64)** (pas un simulateur).
5. **Product → Clean Build Folder**, puis **Product → Archive**.
6. Organizer → **Distribute App** → **App Store Connect** → Upload.
7. Si Apple refuse l’upload en parlant de SDK / Xcode : c’est encore Xcode 15.2. Revenir à l’étape 3.

Détail Archive : [`BUILD-IPA.md`](BUILD-IPA.md).

---

### Étape 8 — TestFlight puis revue Apple

1. Connect → l’app → **TestFlight**. Attendre « Ready to Test » (5–30 min).
2. Installer **TestFlight** sur l’iPhone, tester : connexion, recherche, profil, suppression sur un **compte jetable**.
3. Connect → version **1.1.0** → Build 23 (ou plus) → **Ajouter pour révision** → **Soumettre**.
4. Délai Apple souvent 24–48 h, parfois une semaine.

Chaque nouvel upload : augmenter seulement le **Build** (23 → 24 → 25), garder 1.1.0 tant que c’est la même version Store.

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

---

## Description Store (à coller / adapter)

Easy Dunya met en relation passagers et chauffeurs pour des voyages
entre villes en Mauritanie : recherche, réservation, suivi GPS pendant
le trajet, notifications de réservation.

Ne **pas** écrire « push en arrière-plan ». Ne pas promettre une
fonction absente de l’app.
