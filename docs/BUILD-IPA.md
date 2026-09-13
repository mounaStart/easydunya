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

```bash
npx cap open ios
```

Ou : ouvrir `ios/App/App.xcodeproj` (Capacitor 8 = SPM, pas de `.xcworkspace`).

Dans Xcode :

1. Sélectionnez le projet **App** → cible **App** → onglet **Signing & Capabilities**
2. Cochez **Automatically manage signing**
3. **Team** : votre équipe Apple Developer
4. Vérifiez **Bundle Identifier** = `app.easydunya`
5. Ajoutez si absentes :
   - **Push Notifications**
   - **Background Modes** → **Remote notifications**
6. Branchez un iPhone (ou choisissez un simulateur — le simulateur
   **ne reçoit pas** de vrais push APNs)

Au premier lancement, iOS demandera la **localisation**
(texte Info.plist) puis les **notifications**.

---

## 6. Archive et export de l’IPA

### Test sur votre iPhone (développement)

1. En haut : destination = votre iPhone
2. Menu **Product → Run** (▶)
3. Sur l’iPhone : **Réglages → Général → Gestion de l’appareil**
   → faire confiance au certificat développeur

### IPA Ad Hoc / TestFlight / App Store

1. Destination : **Any iOS Device (arm64)**
2. Menu **Product → Archive**
3. Organizer → sélectionnez l’archive → **Distribute App**
4. Choisissez :
   - **Development** / **Ad Hoc** : IPA à installer via Finder / Apple Configurator
   - **App Store Connect** : TestFlight + publication
5. Laissez Xcode gérer le provisioning → **Export** → récupérez le `.ipa`

L’IPA n’est **pas** généré par `npx cap` : seule Xcode (ou `xcodebuild`
sur macOS) le produit.

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
| `npx cap open ios` sur Linux | Normal : ouvrez le projet sur un Mac |
