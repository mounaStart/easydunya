# Toutes les étapes — Easy Dunya sur Google Play

Contrairement à l’iPhone : **pas besoin d’un Mac**. Un navigateur + GitHub
suffisent. Play Console coûte **25 $ une seule fois** (pas 99 $/an).

L’APK de test (WhatsApp, câble) n’est **pas** le fichier Play Store.
Google demande un **AAB** (Android App Bundle) signé avec **le même
keystore** que vos APK déjà installés (`app.easydunya`).

Ne **pas** utiliser PWABuilder / package `mr.easydunya.app` : ce n’est
pas la même appli, Google la traiterait comme une autre app.

---

## Ordre à suivre

1. Compte Google Play (25 $)  
2. Fusionner confidentialité + suppression de compte sur `main` (Netlify)  
3. Déployer `delete-own-account` (Terminal)  
4. Construire l’**AAB** (GitHub Actions)  
5. Fiche Play Console (politique, fiche, Data safety)  
6. Test interne / test fermé 14 jours  
7. Demander la production → revue Google  

---

### Étape 1 — Payer 25 $ (une fois)

1. Ouvrez [https://play.google.com/console/signup](https://play.google.com/console/signup)
   avec un compte Google (Gmail).
2. Payez **25 USD** (carte). C’est **à vie** pour ce compte, pas un abonnement.
3. Profil développeur : nom **Easy Dunya** (ou votre nom), e-mail / téléphone
   de contact (44030511), adresse.

Attendez l’activation (souvent immédiat, parfois 48 h).

---

### Étape 2 — Site public (politique + suppression)

Play, comme Apple, exige :

- une **politique de confidentialité** sans login ;
- la **suppression de compte dans l’app** (Profil).

L’APK de production charge **https://easydunya.netlify.app**.  
Il faut donc que `main` ait déjà `/confidentialite` et **Profil → Supprimer
mon compte** (branche / PR App Store), puis attendre le déploiement Netlify.

Vérifier dans Chrome :

- https://easydunya.netlify.app/confidentialite  
- https://easydunya.netlify.app/a-propos  

---

### Étape 3 — Fonction suppression (Terminal, pas SQL)

```bash
npx supabase login
npx supabase functions deploy delete-own-account --project-ref prfmqfnaqtmyfyxqjeli
```

Sans ça, le bouton Profil échoue → rejet Play (données personnelles).

---

### Étape 4 — Fabriquer l’AAB (pas l’APK)

GitHub → **Actions** → **Build Android APK** → **Run workflow** :

| Champ | Valeur Play Store |
| --- | --- |
| **ref** | `main` (après l’étape 2) |
| **capacitor_server_url** | `https://easydunya.netlify.app` |

Secrets déjà utilisés par le workflow (ne pas les changer) :

`KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`,
`GOOGLE_SERVICES_JSON`.

Téléchargez les artifacts :

- **EasyDunya-apk** → pour installer à la main / WhatsApp  
- **EasyDunya-aab** → **celui à envoyer à Google**
  (`app-release.aab`)

**Le keystore est unique.** Si vous le perdez, vous ne pourrez plus
mettre à jour l’app Play. Ne le régénérez pas.

`versionCode` actuel : **8** / `versionName` **1.0.7**. Chaque nouvel
upload Play : augmenter le `versionCode` (8 → 9 → 10…).

---

### Étape 5 — Créer l’app dans Play Console

1. [https://play.google.com/console](https://play.google.com/console) → **Créer une app**.
2. Nom : **Easy Dunya**. Langue par défaut : **Français**.
3. Type : **Application**. Gratuit. Déclarez les règles Play + lois US export.
4. Tableau de bord → remplissez **toutes** les sections rouges :

#### Fiche Play Store (principal, FR)

- Titre : Easy Dunya  
- Description courte (~80 car.) : Voyages interurbains en Mauritanie.  
- Description longue : recherche, réservation, GPS, passagers et chauffeurs.  
- Icône : 512×512 PNG (logo).  
- Graphique de présentation : **1024×500**.  
- Captures téléphone : au moins **2** (idéalement 4–8), JPEG/PNG,
  min. 1080 px sur le petit côté. Recherche, voyage, réservation, profil.  
- Catégorie : **Cartes et navigation** ou **Voyages**.  
- E-mail contact + politique :
  `https://easydunya.netlify.app/confidentialite`

#### Questionnaire classification (IARC)

Répondez honnêtement (pas de violence, pas d’achats enfants). Easy Dunya
→ PEGI 3 / tout public en général.

#### Cible / contenu

- Public : **18+** seulement si vous le choisissez ; sinon **tout âge**
  cohérent avec les CGU.  
- Pas de publicité tierce.

#### Data safety (Sécurité des données)

Aligné sur l’app :

| Donnée | Collectée | Liée au compte | Usage |
| --- | --- | --- | --- |
| Nom | Oui | Oui | Fonctionnalité |
| Téléphone | Oui | Oui | Fonctionnalité |
| Position précise | Oui (si GPS accepté) | Oui | Fonctionnalité |
| Position approx. | Oui | Oui | Fonctionnalité |
| Identifiants de l’app | Oui (compte) | Oui | Fonctionnalité |

- **Pas** de vente de données, **pas** de pub ciblée.  
- Suppression de compte : **oui**, dans Profil.  
- Localisation : pas de suivi en arrière-plan (pas de `ACCESS_BACKGROUND_LOCATION`).

#### Autorisations

Play verra `ACCESS_FINE_LOCATION` et `POST_NOTIFICATIONS`.  
Justifier : point de prise en charge / suivi de voyage / notifications de réservation.

#### Identité / compte développeur

Vérification d’identité Google (pièce + selfie) si demandée — obligatoire
avant la production sur les comptes récents.

---

### Étape 6 — Envoyer le AAB (tests)

1. **Tester et publier** → **Production** est souvent **verrouillé** tant
   que le test fermé n’est pas fini (comptes perso créés après nov. 2023).
2. Créez une **version de test interne** (jusqu’à 100 e-mails Gmail) :
   Téléchargez le AAB → notes de version → Enregistrer.  
   Installez depuis le lien Play et vérifiez login / GPS / profil.
3. Puis **test fermé** :
   - au moins **12 testeurs** qui **acceptent** l’invitation ;
   - laisser tourner **14 jours** ;
   - ensuite bouton **Demander l’accès à la production**.

Sans ces 12 personnes + 14 jours, Google refuse la publication publique
sur un compte développeur personnel récent.

---

### Étape 7 — Production et revue

1. Quand l’accès production est ouvert : créez une version **Production**,
   même AAB (ou un plus récent, `versionCode` +1).  
2. Pays : Mauritanie + ceux que vous voulez.  
3. **Envoyer pour examen**. Délai souvent 1–7 jours (parfois plus au 1er
   envoi).  
4. Une fois **Active**, l’app est sur le Play Store
   (`https://play.google.com/store/apps/details?id=app.easydunya`).

---

## Après chaque mise à jour

1. Changer `versionCode` / `versionName` dans `android/app/build.gradle`.  
2. Relancer **Build Android APK** (`ref: main`).  
3. Upload du **nouveau AAB** dans Play Console → Production (ou test).  
4. Si seul le **site** Netlify change et que l’APK charge Netlify : les
   utilisateurs voient le nouveau JS **sans** nouvel AAB. Un nouvel AAB
   est obligatoire pour native (GPS, icône, permissions) ou si Google
   impose un `targetSdk` plus récent.

---

## Différence iPhone / Android

| | App Store (iPhone) | Play Store (Android) |
| --- | --- | --- |
| Machine | Mac **M1+** + Xcode 26 | PC / GitHub Actions |
| Prix compte | 99 $/an | **25 $ une fois** |
| Fichier | IPA / Archive Xcode | **AAB** (pas l’APK WhatsApp) |
| Package | `app.easydunya` | `app.easydunya` |
| Politique | Netlify `/confidentialite` | identique |
| Suppression compte | Profil | identique |

L’APK WhatsApp reste utile pour tester. Ce n’est **pas** la mise en
production Google.
