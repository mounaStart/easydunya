/** Messages d'erreur auth sans jargon « email » pour les comptes téléphone. */

export type AuthErrorContext = "signin" | "signup";

const SIGNIN_RATE_LIMIT =
  "Trop de tentatives de connexion. Attendez 5 à 10 minutes, puis réessayez.";
const SIGNUP_RATE_LIMIT =
  "Trop de tentatives d'inscription. Attendez 5 à 10 minutes, puis réessayez.";

function isRateLimit(msg: string, code?: string): boolean {
  const lower = msg.toLowerCase();
  return (
    code === "over_email_send_rate_limit" ||
    code === "over_request_rate_limit" ||
    code === "over_sms_send_rate_limit" ||
    code === "429" ||
    lower.includes("rate limit") ||
    lower.includes("email rate limit") ||
    lower.includes("too many requests")
  );
}

export function mapAuthError(
  msg: string,
  code?: string,
  context: AuthErrorContext = "signin"
): string {
  const lower = msg.toLowerCase();

  if (code === "email_not_confirmed" || lower.includes("not confirmed")) {
    return "Compte non confirmé. Contactez l'administrateur.";
  }
  if (
    code === "invalid_credentials" ||
    lower.includes("invalid login credentials")
  ) {
    return "Identifiants incorrects. Vérifiez votre numéro (ou email admin) et mot de passe.";
  }
  if (lower.includes("failed to fetch") || lower.includes("network")) {
    return "Impossible de joindre le serveur. Vérifiez votre connexion Internet.";
  }
  if (lower.includes("invalid api key") || lower.includes("missing-anon-key")) {
    return "Clé Supabase manquante ou incorrecte. Copiez la clé « anon public » dans Supabase → Settings → API, mettez-la dans .env (VITE_SUPABASE_ANON_KEY), puis relancez npm run dev.";
  }
  if (lower.includes("email logins are disabled")) {
    return "Connexion indisponible. Contactez l'administrateur.";
  }
  if (isRateLimit(msg, code)) {
    return context === "signup" ? SIGNUP_RATE_LIMIT : SIGNIN_RATE_LIMIT;
  }
  // Connexion : ne jamais afficher le texte « inscription » d'un mapping précédent.
  if (context === "signin" && lower.includes("trop de tentatives d'inscription")) {
    return SIGNIN_RATE_LIMIT;
  }
  if (
    lower.includes("reset-user-password") ||
    lower.includes("functions/v1/reset-user-password")
  ) {
    return "Réinitialisation du mot de passe non activée sur le serveur. Déployez la fonction Supabase « reset-user-password » (Dashboard → Edge Functions), puis réessayez.";
  }
  if (
    lower.includes("create-driver-account") ||
    (lower.includes("edge function") && lower.includes("driver"))
  ) {
    return "Création chauffeur non activée sur le serveur. Déployez la fonction Supabase « create-driver-account » (Dashboard → Edge Functions), puis réessayez.";
  }
  if (
    lower.includes("functions/v1/admin-book-passenger") ||
    lower.includes("admin-book-passenger")
  ) {
    return "Réservation admin non activée sur le serveur. Déployez la fonction Supabase « admin-book-passenger » (Dashboard → Edge Functions), puis réessayez.";
  }
  if (lower.includes("email address") || lower.includes("@phone.easydunya.app")) {
    return "Impossible de créer le compte avec ce numéro. Réessayez ou contactez l'administrateur.";
  }
  if (lower.includes("already") && lower.includes("used")) {
    return "Ce numéro de téléphone est déjà utilisé.";
  }

  return msg;
}

export function isEmailLogin(value: string): boolean {
  return value.includes("@");
}
