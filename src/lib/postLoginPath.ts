import type { UserRole } from "./types";

/**
 * Cible après connexion. On n'envoie jamais un admin sur l'espace chauffeur
 * (ex. `from=/driver` resté après une déconnexion chauffeur).
 */
export function postLoginPath(
  role: UserRole | null | undefined,
  from: string
): string {
  const dest =
    /^\/(?![/\\])/.test(from) && from !== "/login" ? from : "/";

  if (role === "admin") {
    return dest.startsWith("/admin") ? dest : "/admin";
  }

  if (role === "driver") {
    if (dest.startsWith("/admin")) return "/driver";
    return dest;
  }

  if (dest.startsWith("/driver") || dest.startsWith("/admin")) return "/";
  return dest;
}
