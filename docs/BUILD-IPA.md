# Générer un IPA iOS (Easy Dunya + Capacitor)

Easy Dunya est une app **React / Vite** packagée avec **Capacitor**.
Un IPA n’est **pas** une conversion d’APK : c’est un projet Xcode iOS
distinct (`ios/`), généré par Capacitor, signé avec un compte Apple.

> Cette étape **signature + archive + export IPA** se fait uniquement
> sur un **Mac avec Xcode**. Linux / Windows / Cloud Agent peuvent
> préparer le dossier `ios/` (`npx cap add ios` + `npx cap sync ios`)
> mais ne peuvent pas produire l’IPA.

---

## Correspondance Android → iOS

| Android (`android/`) | iOS (`ios/`) |
| --- | --- |
| `ACCESS_FINE_LOCATION` / `ACCESS_COARSE_LOCATION` | `NSLocationWhenInUseUsageDescription` dans `Info.plist` |
| `POST_NOTIFICATIONS` | Capability **Push Notifications** + `UIBackgroundModes` = `remote-notification` |
| `google-services.json` | `GoogleService-Info.plist` (Firebase, **ne pas committer**) |
| `EasyDunyaLocationPlugin.java` | `EasyDunyaLocationPlugin.swift` (GPS + Réglages) |
| `EasyDunyaMessagingService.java` | FCM / APNs via `@capacitor/push-notifications` |
| Canal `easydunya_default` | Non utilisé (canaux = Android seulement) |

Bundle ID / `appId` : **`app.easydunya`** (identique à Android).

---

## Prérequis (Mac)

- macOS + **Xcode** (App Store) + outils ligne de commande
- Compte **Apple Developer** (99 $/an) pour installer sur un iPhone
  réel ou publier sur TestFlight / App Store
- Node.js ≥ 20 + dépendances du repo (`npm ci`)
- Dans [Firebase Console](https://console.firebase.google.com/) :
  1. Ajouter une app **iOS** avec le bundle ID `app.easydunya`
  2. Télécharger **`GoogleService-Info.plist`**
  3. **Project settings → Cloud Messaging → APNs Authentication Key**
     (fichier `.p8` + Key ID + Team ID)

---

## 1. Build du frontend

```bash
npm ci
npm run build
```

Le dossier `dist/` est le `webDir` Capacitor.

Mode distant (défaut, comme l’APK) : l’IPA charge
`https://easydunya.netlify.app`.

Mode embarqué :

```bash
export CAPACITOR_SERVER_URL=embedded
npm run build
npx cap sync ios
```

---

## 2. Plateforme iOS (déjà dans ce dépôt)

Si `ios/` est absent (clone ancien) :

```bash
npx cap add ios
```

Capacitor 8 utilise **Swift Package Manager** (pas CocoaPods).
Xcode télécharge les packages au premier ouvert.

---

## 3. Sync web → projet iOS

```bash
npx cap sync ios
```

Cela recopie `dist/` dans le projet Xcode et met à jour les plugins
(`@capacitor/geolocation`, `@capacitor/push-notifications`, etc.).

Icônes :

```bash
npm run native-icons
```

---

## 4. Firebase iOS + fichier secret

1. Copiez `GoogleService-Info.plist` dans `ios/App/App/`
   (glisser-déposer dans Xcode, cible **App** cochée).
2. Ne commitez **pas** ce fichier (voir `.gitignore`).

### Push : token APNs vs FCM

`@capacitor/push-notifications` sur iOS envoie un **token APNs** (chaîne hex)
dans `device_tokens`. L’edge function `send-fcm` envoie via **FCM** (comme
l’APK Android).

Pour que les notifs iOS passent par le même `send-fcm` :

1. Firebase → ajouter l’app iOS `app.easydunya` + `GoogleService-Info.plist`
2. Firebase → Cloud Messaging → **clé APNs** (.p8)
3. Dans Xcode, ajouter le SDK **Firebase Messaging** (SPM :
   `https://github.com/firebase/firebase-ios-sdk`) et, dans `AppDelegate`,
   convertir le token APNs en token FCM avant de poster
   `.capacitorDidRegisterForRemoteNotifications` (objet = `String` FCM)

Sans cette étape, l’IPA se lance, GPS et UI fonctionnent, mais les
bannières push iOS ne partiront pas depuis `send-fcm`.

Redéployez `send-fcm` après ce PR : le payload `apns` (alerte + son) est
déjà ajouté pour les tokens FCM iOS.

---

## 5. Ouverture dans Xcode et signature

Voir la procédure complète **A → Z** ci-dessous (sections 4 et 5).

```bash
npx cap open ios
```

Ou : ouvrir `ios/App/App.xcodeproj` (Capacitor 8 = SPM, pas de `.xcworkspace`).

---

## 6. Archive et export de l’IPA

Voir **Étape Z** dans le parcours A → Z ci-dessous.

L’IPA n’est **pas** généré par `npx cap` : seule Xcode (ou `xcodebuild`
sur macOS) le produit.

---

## Étapes 4 et 5 — A → Z (Mac + Xcode)

Ces étapes se font **uniquement sur un Mac**. Prévoyez un compte Apple
et, pour un iPhone réel / TestFlight / App Store, le programme
**Apple Developer** (99 $/an).

### A. Préparer le Mac (une seule fois)

1. Installez **Xcode** depuis l’App Store (pas seulement les
   « Command Line Tools »). Vérifiez :

   ```bash
   ls /Applications/Xcode.app
   ```

   S’il n’existe pas : App Store → chercher **Xcode** → Installer
   (plusieurs Go d’espace libre). Puis ouvrez Xcode une fois : acceptez
   la licence dans la fenêtre graphique (pas besoin de `sudo`).

2. Terminal — ces commandes **suffisent**, sans administrateur :

   ```bash
   xcode-select -p
   xcodebuild -version
   ```

   - `xcode-select --install` qui répond *already installed* : **OK, passez**.
   - `xcode-select -p` doit afficher
     `/Applications/Xcode.app/Contents/Developer`.
     S’il affiche `CommandLineTools` et que vous n’avez **pas** `sudo` :
     ouvrez simplement **Xcode.app** ; ou demandez à l’admin du Mac :

     ```bash
     sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
     ```

   - `easydunya is not in the sudoers file` : **ignorez toutes les
     commandes `sudo`**. Ce n’est pas bloquant si Xcode s’ouvre.

3. Installez **Node.js 20+** (https://nodejs.org ou `brew install node`).
4. Xcode → menu **Xcode → Settings… → Accounts** → **+** → connectez
   l’**Apple ID** qui paie le Developer Program.
5. Vérifiez qu’une **Team** apparaît (Personal Team = tests limités 7 jours ;
   **Apple Developer** = IPA / TestFlight / App Store).

### B. Récupérer le projet

```bash
git clone https://github.com/mounaStart/easydunya.git
cd easydunya
git checkout cursor/add-capacitor-ios-0cb8
npm ci
```

### C. Build web + sync Capacitor iOS

```bash
npm run build
npx cap sync ios
```

Raccourci : `npm run cap:ios`.

Par défaut l’app charge **https://easydunya.netlify.app** (comme l’APK).
Pour embarquer `dist/` dans l’IPA :

```bash
export CAPACITOR_SERVER_URL=embedded
npm run build
npx cap sync ios
```

### D. Ouvrir le projet Xcode

```bash
npx cap open ios
```

Sinon : double-clic sur `ios/App/App.xcodeproj`  
(**pas** un `.xcworkspace` — Capacitor 8 = Swift Package Manager).

Au premier ouvert, Xcode télécharge les packages SPM
(Capacitor, Geolocation, Push, StatusBar). Attendez la fin
(barre de progression en haut). Si erreur :

**File → Packages → Reset Package Caches**, puis **File → Packages → Resolve**.

### E. Choisir la cible App

1. À gauche : icône bleue **App** (le projet, tout en haut).
2. Au centre : sous **TARGETS**, cliquez **App** (pas le projet).
3. Onglets utiles : **General**, **Signing & Capabilities**, **Info**.

Vérifiez **General** :

| Champ | Valeur attendue |
| --- | --- |
| Display Name | Easy Dunya |
| Bundle Identifier | `app.easydunya` |
| Version | `1.0.7` |
| Build | `8` |
| Minimum Deployments | iOS 15.0 |
| Supported Destinations | iPhone (portrait) |

### F. Signature (Signing & Capabilities)

1. Onglet **Signing & Capabilities**.
2. Cochez **Automatically manage signing**.
3. **Team** : votre équipe Apple Developer (pas « None »).
4. **Bundle Identifier** : `app.easydunya` (ne pas le changer :
   il doit matcher Firebase / Android).
5. Xcode crée tout seul certificat + profil de provisioning.
   Statut attendu : **Signing Certificate** = Apple Development,
   pas de bandeau rouge.

Si **Team** est grisé : revenez à l’étape A.4 (Accounts).
Si « Failed to register bundle identifier » : l’ID `app.easydunya`
est déjà pris par un autre compte Apple — il faut que **le même
compte** qui a l’app Android / Firebase soit sélectionné, ou
contacter le titulaire de l’équipe.

### G. Capabilities push (si absentes à l’écran)

Le fichier `App.entitlements` contient déjà `aps-environment = development`.

Si **Push Notifications** n’apparaît pas dans la liste :

1. Bouton **+ Capability**
2. Ajoutez **Push Notifications**
3. Ajoutez **Background Modes** → cochez **Remote notifications**

(Le `Info.plist` a déjà `UIBackgroundModes` = `remote-notification`.)

Pour un IPA **Development / test** : laissez `development`.  
Pour **TestFlight / App Store**, Xcode bascule en général vers
`production` à l’export. Si Validation échoue sur `aps-environment`,
passez la valeur à `production` uniquement pour l’archive Store.

### H. (Optionnel) Firebase — uniquement pour les push iOS

Sans ça, l’app se lance (UI, GPS, site Netlify) mais `send-fcm`
n’enverra pas de bannières iOS.

1. [Firebase Console](https://console.firebase.google.com/) → projet Easy Dunya.
2. **Ajouter une app iOS**, bundle ID `app.easydunya`, nom Easy Dunya.
3. Téléchargez **GoogleService-Info.plist**.
4. Dans Xcode : glissez le fichier dans le dossier **App** (même niveau
   que `AppDelegate.swift`). Cochez **Copy items if needed** et la
   cible **App**.
5. Project settings → **Cloud Messaging** → **APNs Authentication Key**
   : uploadez le `.p8` (Apple Developer → Certificates, Identifiers &
   Profiles → Keys → une clé avec Apple Push Notifications service).
6. Ne commitez **pas** `GoogleService-Info.plist`.

### I. Brancher l’iPhone

1. Câble USB, déverrouillez l’iPhone, touchez **Faire confiance**.
2. iPhone : **Réglages → Confidentialité et sécurité → Mode développeur**
   → activer (iOS 16+), redémarrer si demandé.
3. Dans Xcode, en haut à côté du bouton ▶ : choisissez **votre iPhone**.
   Évitez « Any iOS Device » pour un simple test, et le **simulateur**
   si vous voulez tester le push (APNs = appareil réel).

### J. Premier lancement (test sans IPA)

1. **Product → Run** (▶) ou `⌘R`.
2. Si « Untrusted Developer » sur l’iPhone :
   **Réglages → Général → VPN et gestion de l’appareil**
   (ou **Gestion de l’appareil**) → votre certificat → **Faire confiance**.
3. L’app **Easy Dunya** s’ouvre. Autorisez **position** puis
   **notifications** quand iOS le demande.
4. Connectez-vous : le site Netlify se charge dans la WebView Capacitor.

C’est l’étape 4 terminée : projet ouvert, signé, installé en debug.

### K. Préparer l’archive (étape 5)

1. En haut, destination : **Any iOS Device (arm64)**  
   (pas un simulateur — Archive est grisé sinon).
2. Menu **Product → Destination** si la liste est cachée.
3. **Product → Clean Build Folder** (`⇧⌘K`) — recommandé.
4. **Product → Archive** (`⌃⌘A` selon raccourcis).
5. Attendez la compilation (plusieurs minutes la 1ʳᵉ fois, SPM).

Si Archive est grisé : la destination est encore un simulateur.

### L. Organizer → Distribute App

La fenêtre **Organizer** s’ouvre (sinon **Window → Organizer**).
Onglet **Archives** → dernière archive **Easy Dunya** / **App**.

Cliquez **Distribute App**. Choisissez **une** méthode :

| Méthode | Pour qui | Résultat |
| --- | --- | --- |
| **Development** | Vos iPhones enregistrés (Udids de l’équipe) | `.ipa` de test, signature dev |
| **Ad Hoc** | Jusqu’à 100 iPhones dont l’UDID est dans le profil | `.ipa` à envoyer (AirDrop, Drive) |
| **App Store Connect** | TestFlight + App Store | upload, pas toujours un IPA local |
| **Enterprise** | Compte Entreprise Apple uniquement | distribution interne |

Pour « j’ai un fichier IPA à installer » : **Development** (vos
appareils) ou **Ad Hoc** (testeurs dont vous avez l’UDID).

### M. Assistant d’export (écrans suivants)

1. **Distribution options** : laissez **All compatible device variants**.
2. **Re-sign** : **Automatically manage signing** (même Team).
3. **Review** : Bundle `app.easydunya`, version `1.0.7` (8).
4. **Export** (Development / Ad Hoc) → choisissez un dossier
   (ex. Bureau) → **Export**.
5. Vous obtenez un dossier avec **`App.ipa`** (renommez-le
   `EasyDunya-1.0.7.ipa` si vous voulez).

Pour **App Store Connect** : **Upload** → Xcode envoie le binaire.
Puis [App Store Connect](https://appstoreconnect.apple.com/) →
votre app → **TestFlight** (traitement ~5–30 min) → ajouter des
testeurs.

### N. Installer l’IPA sur un iPhone

**Development / Ad Hoc :**

1. Sur le Mac : **Finder** → iPhone dans la barre latérale →
   **Fichiers** / section Apps, ou glisser l’IPA sur l’icône
   de l’iPhone (selon la version de macOS).
2. Ou **Apple Configurator 2** (App Store) → glisser l’IPA.
3. Ou Xcode → **Window → Devices and Simulators** → iPhone →
   **Installed Apps** → **+** → choisir l’IPA.

Sur l’iPhone, faire confiance au profil si demandé
(étape J.2).

**TestFlight :** installer l’app **TestFlight**, accepter
l’invitation e-mail / public link, installer Easy Dunya.

### O. Après chaque modification du code web

```bash
npm run build
npx cap sync ios
```

Puis dans Xcode : **Run** (test) ou **Archive** (nouvel IPA).
Incrémentez **Build** (`CURRENT_PROJECT_VERSION`) avant chaque
upload TestFlight (8 → 9 → 10…). Le site Netlify se met à jour
sans nouvel IPA si vous restez en mode URL distante.

---

## 7. Après chaque changement web

```bash
npm run build
npx cap sync ios
```

Puis dans Xcode : **Product → Run** ou **Archive** à nouveau.

Si vous restez en mode URL Netlify, un simple déploiement Netlify
met à jour le contenu sans refaire l’IPA (le binaire Capacitor charge
le site distant).

---

## Dépannage

| Problème | Solution |
| --- | --- |
| Packages SPM introuvables | Xcode → File → Packages → Reset Package Caches, puis Rebuild |
| Signature / Team gris | Compte Apple connecté dans Xcode → Settings → Accounts |
| « Failed to register » push | Capability Push absente, ou simulateur (APNs = iPhone réel) |
| Token iOS ignoré par `send-fcm` | Le plugin Capacitor iOS enregistre un **token APNs** (hex). `send-fcm` attend un token **FCM**. Voir ci-dessous. |
| Bannière iOS n’apparaît pas | Vérifier `send-fcm` (payload `apns`) déployé ; permission Notifications = Autoriser |
| Localisation refusée | Réglages iPhone → Easy Dunya → Position → **Lorsque l’app est active** |
| Écran blanc | Rebuild avec les bonnes variables `VITE_*` (mode `embedded`) ou vérifier l’URL Netlify |
| Profil introuvable après login | `npm run cap:ios` (embarqué). L’app ne doit **pas** charger Netlify. Supprimer l’app, Clean, ▶. |
| `npx cap open ios` sur Linux | Normal : ouvrez le projet sur un Mac |
