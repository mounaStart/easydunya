/** Messages d'erreur auth sans jargon « email » pour les comptes téléphone. */
export function mapAuthError(msg: string, code?: string): string {
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
  if (
    code === "over_email_send_rate_limit" ||
    lower.includes("rate limit") ||
    lower.includes("email rate limit")
  ) {
    return "Trop de tentatives d'inscription. Attendez 5 à 10 minutes, puis réessayez.";
  }
  if (
    lower.includes("create-driver-account") ||
    (lower.includes("edge function") && lower.includes("driver"))
  ) {
    return "Création chauffeur non activée sur le serveur. Déployez la fonction Supabase « create-driver-account » (Dashboard → Edge Functions), puis réessayez.";
  }
  if (
    lower.includes("edge function") ||
    lower.includes("functions/v1/create-driver-account") ||
    lower.includes("functions/v1/register-passenger") ||
    lower.includes("register-passenger") ||
    lower.includes("not found")
  ) {
    return "Inscription non activée sur le serveur. Déployez la fonction Supabase « register-passenger » (Dashboard → Edge Functions), puis réessayez.";
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
