#!/usr/bin/env python3
"""Génère le rapport PDF complet de vérification sécurité client Easy Dunya."""

from datetime import date
from pathlib import Path

from fpdf import FPDF

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "RAPPORT-SECURITE-CLIENT-EASY-DUNYA.pdf"
LOGO = ROOT / "public" / "brand" / "logo.png"
FONT = Path(r"C:\Windows\Fonts\arial.ttf")
FONT_B = Path(r"C:\Windows\Fonts\arialbd.ttf")

BRAND_BLUE = (30, 136, 214)
BRAND_ORANGE = (245, 124, 0)


class RapportPDF(FPDF):
    def header(self):
        if self.page_no() == 1:
            return
        logo_w = 28
        logo_h = logo_w * 682 / 1024
        self.image(str(LOGO), x=10, y=8, w=logo_w)
        self.set_xy(10 + logo_w + 4, 10)
        self.set_font("Arial", "B", 10)
        self.set_text_color(*BRAND_BLUE)
        self.cell(0, 5, "Easy Dunya")
        self.set_xy(10 + logo_w + 4, 15)
        self.set_font("Arial", "", 8)
        self.set_text_color(100, 100, 100)
        self.cell(0, 4, "Rapport de vérification sécurité — 4 correctifs client")
        self.ln(18)
        self.set_draw_color(*BRAND_BLUE)
        self.line(10, 26, 200, 26)
        self.ln(6)
        self.set_text_color(0, 0, 0)

    def footer(self):
        self.set_y(-15)
        self.set_font("Arial", "", 8)
        self.set_text_color(120, 120, 120)
        self.cell(
            0,
            10,
            f"Easy Dunya — easydunya.netlify.app — Page {self.page_no()}/{{nb}}",
            align="C",
        )

    def section_title(self, num: str, title: str):
        self.ln(2)
        self.set_fill_color(*BRAND_BLUE)
        self.set_text_color(255, 255, 255)
        self.set_font("Arial", "B", 12)
        self.cell(0, 9, f"  {num}. {title}", fill=True)
        self.ln(11)
        self.set_text_color(0, 0, 0)

    def sub_title(self, title: str):
        self.set_font("Arial", "B", 10)
        self.set_text_color(*BRAND_ORANGE)
        self.cell(0, 6, title)
        self.ln(7)
        self.set_text_color(0, 0, 0)

    def body(self, text: str):
        self.set_font("Arial", "", 10)
        self.multi_cell(0, 5, text)
        self.ln(2)

    def bullet(self, text: str):
        self.set_font("Arial", "", 10)
        self.multi_cell(0, 5, f"  •  {text}")
        self.ln(1)

    def ok_box(self, text: str):
        self.set_fill_color(232, 245, 233)
        self.set_draw_color(76, 175, 80)
        self.set_font("Arial", "B", 10)
        self.multi_cell(0, 7, f"  [OK]  {text}", border=1, fill=True)
        self.ln(3)


def cover_page(pdf: RapportPDF) -> None:
    pdf.add_page()
    logo_w = 90
    logo_h = logo_w * 682 / 1024
    x = (210 - logo_w) / 2
    pdf.image(str(LOGO), x=x, y=28, w=logo_w)
    pdf.ln(logo_h + 18)

    pdf.set_font("Arial", "B", 22)
    pdf.set_text_color(*BRAND_BLUE)
    pdf.cell(0, 12, "Rapport de vérification", align="C")
    pdf.ln(14)

    pdf.set_font("Arial", "B", 16)
    pdf.cell(0, 9, "Correctifs sécurité client", align="C")
    pdf.ln(10)

    pdf.set_font("Arial", "B", 20)
    pdf.set_text_color(*BRAND_ORANGE)
    pdf.cell(0, 10, "Easy Dunya", align="C")
    pdf.ln(16)

    pdf.set_text_color(0, 0, 0)
    pdf.set_font("Arial", "", 11)
    pdf.cell(0, 7, f"Date du rapport : {date.today().strftime('%d/%m/%Y')}", align="C")
    pdf.ln(7)
    pdf.cell(0, 7, "Site : https://easydunya.netlify.app", align="C")
    pdf.ln(7)
    pdf.cell(0, 7, "Application : APK Android (Capacitor) + PWA Web", align="C")
    pdf.ln(7)
    pdf.cell(0, 7, "Périmètre : 4 correctifs client — audit expert", align="C")
    pdf.ln(12)

    pdf.set_fill_color(232, 245, 233)
    pdf.set_draw_color(76, 175, 80)
    pdf.set_font("Arial", "B", 12)
    pdf.cell(0, 10, "  STATUT GLOBAL : TOUS LES TESTS VALIDÉS", align="C", border=1, fill=True)
    pdf.ln(16)

    pdf.set_font("Arial", "", 10)
    pdf.multi_cell(
        0,
        5,
        "Ce document résume la mise en place et la vérification des quatre correctifs "
        "de sécurité identifiés lors de l'audit expert du client Easy Dunya. "
        "Les tests ont été exécutés manuellement sur le navigateur Chrome et sur "
        "l'APK Android installé sur téléphone.",
        align="C",
    )

    pdf.ln(8)
    pdf.set_font("Arial", "B", 10)
    pdf.cell(0, 6, "Sommaire", align="C")
    pdf.ln(8)
    pdf.set_font("Arial", "", 10)
    for line in [
        "1. Protection open redirect (notifications push)",
        "2. En-têtes de sécurité HTTP (netlify.toml)",
        "3. Redirection après connexion validée (Login.tsx)",
        "4. Codes de confirmation imprévisibles (codes.ts)",
    ]:
        pdf.cell(0, 6, line, align="C")
        pdf.ln(6)


def section_1(pdf: RapportPDF) -> None:
    pdf.add_page()
    pdf.section_title("1", "Protection contre l'open redirect (notifications)")

    pdf.sub_title("Problème identifié")
    pdf.body(
        "Un attaquant pouvait forger une notification push contenant une URL externe "
        "(ex. https://evil.com). Au clic, l'utilisateur était redirigé vers un site "
        "malveillant imitant Easy Dunya (phishing)."
    )

    pdf.sub_title("Correctif appliqué")
    pdf.bullet(
        "Web / PWA : fonction sameOriginUrl() dans public/push-sw.js — "
        "seules les URLs de la même origine (easydunya.netlify.app) sont autorisées."
    )
    pdf.bullet(
        "APK Android : fonction safeAppPath() dans src/lib/nativePush.ts — "
        "même règle au clic sur une notification FCM native."
    )
    pdf.bullet(
        "Architecture : sw.js charge push-sw.js via importScripts() ; "
        "sameOriginUrl n'apparaît pas dans sw.js mais dans push-sw.js."
    )

    pdf.sub_title("Tests effectués — Web (navigateur Chrome)")
    pdf.bullet(
        "Vérification du fichier push-sw.js en production : présence de sameOriginUrl confirmée."
    )
    pdf.bullet(
        "Test console (connecté admin + non connecté) : "
        'showNotification avec data.url = "https://evil.com/faux-easydunya". '
        "Résultat : au clic, redirection vers Easy Dunya uniquement, jamais vers evil.com."
    )
    pdf.bullet(
        "Service Worker actif (sw.js) vérifié dans DevTools → Application → Service workers."
    )

    pdf.sub_title("Tests effectués — APK Android")
    pdf.bullet(
        "Insertion SQL d'une notification test avec URL malveillante dans data.url."
    )
    pdf.bullet(
        "Notification reçue ; clic → ouverture de l'APK Easy Dunya "
        "(pas de navigateur externe, pas de redirection vers evil.com)."
    )
    pdf.bullet(
        "Notification visible dans la cloche in-app — comportement normal (même entrée en base)."
    )
    pdf.ok_box("Point 1 — VALIDÉ : protection open redirect active sur Web et APK.")


def section_2(pdf: RapportPDF) -> None:
    pdf.add_page()
    pdf.section_title("2", "En-têtes de sécurité HTTP (netlify.toml)")

    pdf.sub_title("Problème identifié")
    pdf.body(
        "Le site était servi sans en-têtes de sécurité standards, exposant à : "
        "clickjacking (iframe invisible), devinette de type MIME (vecteur XSS), "
        "fuite d'URL via Referer vers des sites tiers, et absence de forçage HTTPS "
        "au niveau navigateur (HSTS)."
    )

    pdf.sub_title("Correctif appliqué (netlify.toml)")
    pdf.bullet("Strict-Transport-Security : max-age=31536000; includeSubDomains")
    pdf.bullet("X-Frame-Options : DENY")
    pdf.bullet("Content-Security-Policy : frame-ancestors 'none'")
    pdf.bullet("X-Content-Type-Options : nosniff")
    pdf.bullet("Referrer-Policy : strict-origin-when-cross-origin")
    pdf.bullet(
        "Permissions-Policy : camera=(), microphone=(), payment=(), geolocation=(self)"
    )

    pdf.sub_title("Tests effectués")
    pdf.bullet(
        "Méthode 1 — Chrome DevTools (Réseau → Response Headers) : "
        "les 6 en-têtes présents et conformes."
    )
    pdf.bullet(
        "Méthode 2 — Outil en ligne securityheaders.com : note satisfaisante (A / B+)."
    )
    pdf.bullet(
        "Méthode 3 — Test clickjacking (iframe locale) : "
        "refus d'affichage dans l'iframe — protection active."
    )
    pdf.bullet(
        "Méthode 4 — PowerShell Invoke-WebRequest -Method Head : "
        "en-têtes confirmés côté serveur Netlify Edge."
    )
    pdf.ok_box("Point 2 — VALIDÉ : en-têtes de sécurité HTTP déployés et actifs en production.")


def section_3(pdf: RapportPDF) -> None:
    pdf.add_page()
    pdf.section_title("3", "Redirection après connexion validée (Login.tsx)")

    pdf.sub_title("Problème identifié")
    pdf.body(
        "Après connexion, l'application naviguait vers state.from sans validation. "
        "Le risque d'exploitation directe était faible (state posé par notre code), "
        "mais ce chemin devient exploitable avec des contournements par backslash "
        "(//host, /\\host) comme dans les CVE récentes de React Router."
    )

    pdf.sub_title("Correctif appliqué (src/pages/Login.tsx)")
    pdf.bullet(
        "Validation par regex : /^\\/(?![/\\\\])/ — seuls les chemins internes "
        "commençant par / (sans // ni /\\) sont acceptés."
    )
    pdf.bullet("Toute valeur invalide est remplacée par / (accueil).")
    pdf.bullet(
        "Cas légitime conservé : redirection vers /admin, /profile, /trips/… "
        "après connexion depuis une page protégée."
    )

    pdf.sub_title("Tests effectués")
    pdf.bullet(
        "Test A — Accès /admin sans connexion → login → redirection vers /admin (OK)."
    )
    pdf.bullet(
        'Test B — Injection state.from = "//evil.com" via history.replaceState → '
        "après login, reste sur easydunya.netlify.app (accueil /)."
    )
    pdf.bullet(
        'Test C — Injection state.from = "/\\\\evil.com" (backslash) → '
        "bloqué, redirection vers /."
    )
    pdf.bullet(
        'Test D — Injection state.from = "https://evil.com/phishing" → '
        "bloqué, redirection vers /."
    )
    pdf.bullet(
        "Test E — Login depuis page voyage (/trips/…) → retour sur la page du voyage."
    )
    pdf.ok_box(
        "Point 3 — VALIDÉ : aucune redirection externe après connexion ; "
        "chemins internes légitimes fonctionnels."
    )


def section_4(pdf: RapportPDF) -> None:
    pdf.add_page()
    pdf.section_title("4", "Codes de confirmation imprévisibles (codes.ts)")

    pdf.sub_title("Problème identifié")
    pdf.body(
        "Le code à 6 caractères d'une réservation est une clé d'accès : quiconque le "
        "connaît voit le nom et le téléphone du passager (page « Vérifier une réservation »). "
        "L'ancien générateur utilisait Math.random() (prévisible) avec un léger biais "
        "statistique via le modulo."
    )

    pdf.sub_title("Correctif appliqué (src/lib/codes.ts)")
    pdf.bullet(
        "Génération exclusive via crypto.getRandomValues() — jamais Math.random()."
    )
    pdf.bullet(
        "Rejet des valeurs biaisées (rejection sampling) pour une distribution uniforme "
        "sur l'alphabet de 31 caractères."
    )
    pdf.bullet(
        "Alphabet sans caractères ambigus : pas de 0/O, 1/I/L — format 6 caractères majuscules."
    )
    pdf.bullet("Espace des codes : 31^6 ≈ 887 millions de combinaisons.")

    pdf.sub_title("Tests effectués")
    pdf.bullet(
        "Test A — Création de réservation : code 6 caractères, alphabet conforme, "
        "codes distincts entre deux réservations."
    )
    pdf.bullet(
        "Test B — Page /check : codes inventés (AAAAAA, 000000, OIL111…) → "
        "réservation introuvable ou refusée."
    )
    pdf.bullet(
        "Test C — Inspection du build : getRandomValues présent, Math.random absent "
        "dans la logique de génération."
    )
    pdf.bullet(
        "Test D — Génération console (10 codes) : tous valides, variés, sans caractères interdits."
    )
    pdf.bullet(
        "Test E — Tentatives de devinette (codes aléatoires) : aucun code inventé ne "
        "donne accès aux données passager."
    )
    pdf.ok_box(
        "Point 4 — VALIDÉ : codes cryptographiquement aléatoires, non prévisibles."
    )


def synthesis(pdf: RapportPDF) -> None:
    pdf.add_page()
    pdf.section_title("", "Synthèse et conclusion")

    pdf.body(
        "Les quatre correctifs de sécurité client identifiés lors de l'audit expert "
        "ont été implémentés dans le dépôt GitHub (branche main), déployés sur Netlify "
        "(https://easydunya.netlify.app) et vérifiés manuellement par l'équipe Easy Dunya "
        "sur navigateur Chrome et APK Android."
    )

    pdf.ln(2)
    pdf.sub_title("Tableau récapitulatif")
    pdf.set_font("Arial", "B", 9)
    pdf.set_fill_color(230, 240, 250)
    pdf.cell(12, 8, "N°", border=1, fill=True)
    pdf.cell(78, 8, "Correctif", border=1, fill=True)
    pdf.cell(55, 8, "Fichier source", border=1, fill=True)
    pdf.cell(45, 8, "Statut", border=1, fill=True)
    pdf.ln(8)

    rows = [
        ("1", "Open redirect notifications", "push-sw.js, nativePush.ts", "OK — Web + APK"),
        ("2", "En-têtes HTTP sécurité", "netlify.toml", "OK — 4 méthodes"),
        ("3", "Redirection login validée", "Login.tsx", "OK — 5 tests"),
        ("4", "Codes confirmation sécurisés", "codes.ts", "OK — 5 tests"),
    ]
    pdf.set_font("Arial", "", 9)
    for num, title, src, status in rows:
        pdf.cell(12, 7, num, border=1)
        pdf.cell(78, 7, title, border=1)
        pdf.cell(55, 7, src, border=1)
        pdf.cell(45, 7, status, border=1)
        pdf.ln(7)

    pdf.ln(8)
    pdf.set_fill_color(232, 245, 233)
    pdf.set_draw_color(76, 175, 80)
    pdf.set_font("Arial", "B", 11)
    pdf.multi_cell(
        0,
        8,
        "  CONCLUSION : Les 4 points de l'audit sécurité client sont corrigés, "
        "déployés en production et validés par tests manuels.",
        border=1,
        fill=True,
    )

    pdf.ln(10)
    pdf.set_font("Arial", "", 9)
    pdf.set_text_color(100, 100, 100)
    pdf.multi_cell(
        0,
        4,
        "Document généré automatiquement — Easy Dunya / mounaStart/easydunya. "
        "Regénération : python scripts/generate_rapport_securite_pdf.py",
    )


def build_pdf() -> None:
    if not LOGO.exists():
        raise FileNotFoundError(f"Logo introuvable : {LOGO}")

    pdf = RapportPDF()
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=20)
    pdf.add_font("Arial", "", str(FONT))
    pdf.add_font("Arial", "B", str(FONT_B))

    cover_page(pdf)
    section_1(pdf)
    section_2(pdf)
    section_3(pdf)
    section_4(pdf)
    synthesis(pdf)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(OUT))
    print(f"PDF généré : {OUT}")


if __name__ == "__main__":
    build_pdf()
