import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { type Session, type User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { fetchProfileWithAccessToken, profileFromUser } from "../lib/profileApi";
import { phoneToEmail } from "../lib/phone";
import { mapAuthError } from "../lib/authErrors";
import { rebindPushToUser, unsubscribeFromPush } from "../lib/push";
import { isIosApp, isNativePlatform, isNativePushSupported } from "../lib/nativePush";
import type { Profile, UserRole } from "../lib/types";

interface AuthContextValue {
  /** Première lecture de la session Supabase. */
  loading: boolean;
  /** Profil en cours de chargement pour l'utilisateur courant. */
  profileLoading: boolean;
  /** Session et profil cohérents (prêt pour les routes protégées). */
  authReady: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  role: UserRole | null;
  isAdmin: boolean;
  isDriver: boolean;
  isPassenger: boolean;
  mustChangePassword: boolean;
  /** Passagers et chauffeurs : téléphone + mot de passe */
  signInWithPhone: (
    phone: string,
    password: string
  ) => Promise<{ error?: string; code?: string }>;
  /** Admin : connexion par email + mot de passe */
  signInWithEmail: (
    email: string,
    password: string
  ) => Promise<{ error?: string; code?: string }>;
  /** Inscription passager : nom + téléphone + mot de passe (sans email) */
  signUpPassenger: (params: {
    fullName: string;
    phone: string;
    password: string;
  }) => Promise<{ error?: string }>;
  /** Admin crée un compte chauffeur (téléphone + mot de passe temporaire + véhicule) */
  createDriverAccount: (params: {
    fullName: string;
    phone: string;
    password: string;
    baseCityId?: string;
    vehicleMake?: string;
    vehiclePlate?: string;
    vehicleSeats?: number;
    vehicleFeatures?: string;
  }) => Promise<{ error?: string }>;
  /** Changement du mot de passe (obligatoire à la 1ère connexion chauffeur) */
  changeOwnPassword: (newPassword: string) => Promise<{ error?: string }>;
  resetPasswordByPhone: (
    phone: string,
    newPassword: string
  ) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const loadProfileForRef = useRef<string | null>(null);
  const loadGenRef = useRef(0);
  const sessionRef = useRef<Session | null>(null);
  const initialAuthDoneRef = useRef(false);
  /** iOS WKWebView envoie parfois SIGNED_OUT tout seul après le login. */
  const explicitSignOutRef = useRef(false);
  const restoringSessionRef = useRef(false);

  const loadProfile = useCallback(
    async (u: User, opts?: { silent?: boolean; accessToken?: string }) => {
      const requestId = ++loadGenRef.current;
      loadProfileForRef.current = u.id;
      // Ne jamais vider le profil : l'écran « introuvable » bloquait iOS
      // (select timeout + upsert admin/chauffeur refusé par le RLS).
      setProfile((prev) => (prev?.id === u.id ? prev : profileFromUser(u)));
      if (!opts?.silent) setProfileLoading(false);

      const token = opts?.accessToken;
      if (!token) return;
      void fetchProfileWithAccessToken(u.id, token).then((data) => {
        if (requestId !== loadGenRef.current || loadProfileForRef.current !== u.id) {
          return;
        }
        if (data) setProfile(data);
      });
    },
    []
  );

  const applySession = useCallback(
    async (s: Session, event?: string) => {
      explicitSignOutRef.current = false;
      sessionRef.current = s;
      setSession(s);
      setProfile((prev) => (prev?.id === s.user.id ? prev : profileFromUser(s.user)));
      setProfileLoading(false);
      const silent =
        event !== "SIGNED_IN" && loadProfileForRef.current === s.user.id;
      await loadProfile(s.user, { silent, accessToken: s.access_token });
      if (
        (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") &&
        isNativePushSupported()
      ) {
        rebindPushToUser(s.user.id).catch(() => {});
      }
    },
    [loadProfile]
  );

  const clearSession = useCallback(() => {
    sessionRef.current = null;
    loadProfileForRef.current = null;
    setSession(null);
    setProfile(null);
    setProfileLoading(false);
  }, []);

  const refreshSessionFromStorage = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const s = data.session;
    if (s?.user) {
      await applySession(s);
      return;
    }
    // iOS : getSession() peut renvoyer null juste après un login réussi.
    // Ne pas effacer la session mémoire (sinon « Profil introuvable »).
    if (sessionRef.current) return;
    clearSession();
  }, [applySession, clearSession]);

  useEffect(() => {
    let cancelled = false;

    const finishInitialLoad = () => {
      if (cancelled || initialAuthDoneRef.current) return;
      initialAuthDoneRef.current = true;
      setLoading(false);
    };

    const bootstrapTimeout = window.setTimeout(finishInitialLoad, 12_000);

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session?.user) {
        void applySession(data.session).finally(finishInitialLoad);
      } else {
        finishInitialLoad();
      }
    });

    // Ne pas await dans ce callback (verrou auth iOS). Ignorer les sessions
    // vides : getSession / TOKEN_REFRESHED peuvent arriver à vide sur WKWebView.
    const { data: sub } = supabase.auth.onAuthStateChange((evt, s) => {
      if (cancelled) return;
      if (evt === "INITIAL_SESSION") {
        finishInitialLoad();
        return;
      }
      window.setTimeout(() => {
        if (cancelled) return;
        if (evt === "SIGNED_OUT") {
          if (!explicitSignOutRef.current && isIosApp()) {
            const kept = sessionRef.current;
            if (
              kept?.access_token &&
              kept.refresh_token &&
              !restoringSessionRef.current
            ) {
              restoringSessionRef.current = true;
              console.warn("[auth] SIGNED_OUT ignoré — restauration session iOS");
              void supabase.auth
                .setSession({
                  access_token: kept.access_token,
                  refresh_token: kept.refresh_token,
                })
                .catch((err) => {
                  console.warn("[auth] restauration session iOS:", err);
                })
                .finally(() => {
                  restoringSessionRef.current = false;
                });
            } else {
              console.warn("[auth] SIGNED_OUT ignoré (iOS, déconnexion non demandée)");
            }
            return;
          }
          clearSession();
          return;
        }
        if (s?.user) void applySession(s, evt);
      }, 0);
    });

    return () => {
      cancelled = true;
      window.clearTimeout(bootstrapTimeout);
      sub.subscription.unsubscribe();
    };
  }, [applySession, clearSession]);

  useEffect(() => {
    if (isNativePlatform()) {
      return undefined;
    }

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void refreshSessionFromStorage();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refreshSessionFromStorage]);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) return { error: error.message, code: error.code };
    if (data.session?.user) await applySession(data.session, "SIGNED_IN");
    return {};
  }, [applySession]);

  const signInWithPhone = useCallback(async (phone: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: phoneToEmail(phone),
      password,
    });
    if (error) return { error: error.message, code: error.code };
    if (data.session?.user) await applySession(data.session, "SIGNED_IN");
    return {};
  }, [applySession]);

  const signUpPassenger = useCallback(
    async ({
      fullName,
      phone,
      password,
    }: {
      fullName: string;
      phone: string;
      password: string;
    }) => {
      const trimmedPhone = phone.trim();
      const { data: taken } = await supabase.rpc("is_phone_taken", {
        p_phone: trimmedPhone,
      });
      if (taken === true) {
        return { error: "Ce numéro de téléphone est déjà utilisé." };
      }

      const finishSignIn = async () => {
        const { error: signInError, code } = await signInWithPhone(
          trimmedPhone,
          password
        );
        if (signInError) return { error: mapAuthError(signInError, code) };
        return {};
      };

      const signUpViaEdgeFunction = async (): Promise<{
        error?: string;
        unavailable?: boolean;
      }> => {
        const { data: fnData, error: fnError } = await supabase.functions.invoke(
          "register-passenger",
          { body: { fullName, phone: trimmedPhone, password } }
        );
        if (fnError) {
          const raw = fnError.message.toLowerCase();
          const missing =
            raw.includes("edge function") ||
            raw.includes("not found") ||
            raw.includes("404");
          if (missing) return { unavailable: true };
          return { error: mapAuthError(fnError.message) };
        }
        const payload = fnData as { error?: string } | null;
        if (payload?.error) return { error: mapAuthError(payload.error) };
        return {};
      };

      const signUpDirect = async (): Promise<{ error?: string }> => {
        const { data, error } = await supabase.auth.signUp({
          email: phoneToEmail(trimmedPhone),
          password,
          options: {
            data: { full_name: fullName, phone: trimmedPhone, role: "passenger" },
          },
        });

        if (error) {
          return { error: mapAuthError(error.message, error.code) };
        }

        if (data.user && (data.user.identities?.length ?? 0) === 0) {
          return { error: "Ce numéro de téléphone est déjà utilisé." };
        }

        if (data.user) {
          await supabase.from("profiles").insert({
            id: data.user.id,
            role: "passenger",
            full_name: fullName,
            phone: trimmedPhone,
          });
          if (data.session?.user) {
            await loadProfile(data.session.user, {
              accessToken: data.session.access_token,
            });
            return {};
          }
        }

        return finishSignIn();
      };

      // Projet prfmqfna : Edge Function d'abord (pas d'email, pas de rate limit signUp).
      const edge = await signUpViaEdgeFunction();
      if (!edge.error && !edge.unavailable) return finishSignIn();
      if (edge.error) return edge;

      // Ancienne base sans Edge Function : signUp direct.
      return signUpDirect();
    },
    [loadProfile, signInWithPhone]
  );

  const createDriverAccount = useCallback(
    async ({
      fullName,
      phone,
      password,
      baseCityId,
      vehicleMake,
      vehiclePlate,
      vehicleSeats,
      vehicleFeatures,
    }: {
      fullName: string;
      phone: string;
      password: string;
      baseCityId?: string;
      vehicleMake?: string;
      vehiclePlate?: string;
      vehicleSeats?: number;
      vehicleFeatures?: string;
    }) => {
      const trimmedPhone = phone.trim();
      const { data: taken } = await supabase.rpc("is_phone_taken", {
        p_phone: trimmedPhone,
      });
      if (taken === true) {
        return { error: "Ce numéro de téléphone est déjà utilisé." };
      }

      // Création chauffeur via Edge Function (admin connecté, API Admin)
      const { data: fnData, error: fnError } = await supabase.functions.invoke(
        "create-driver-account",
        {
          body: {
            fullName,
            phone: trimmedPhone,
            password,
            baseCityId,
            vehicleMake,
            vehiclePlate,
            vehicleSeats,
            vehicleFeatures,
          },
        }
      );

      if (fnError) {
        const raw = fnError.message.toLowerCase();
        const missing =
          raw.includes("edge function") ||
          raw.includes("not found") ||
          raw.includes("404") ||
          raw.includes("failed to send");
        if (missing) {
          return {
            error:
              "Création chauffeur non activée sur le serveur. Déployez la fonction Supabase « create-driver-account » (Dashboard → Edge Functions), puis réessayez.",
          };
        }
        return { error: mapAuthError(fnError.message) };
      }

      const payload = fnData as { error?: string; ok?: boolean } | null;
      if (payload?.error) {
        return { error: mapAuthError(payload.error) };
      }

      return {};
    },
    []
  );

  const changeOwnPassword = useCallback(
    async (newPassword: string) => {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) return { error: error.message };
      if (session?.user) {
        await supabase
          .from("profiles")
          .update({ must_change_password: false })
          .eq("id", session.user.id);
        await loadProfile(session.user, { accessToken: session.access_token });
        await supabase.rpc("notify_user", {
          p_user: session.user.id,
          p_title: "Mot de passe réinitialisé ✓",
          p_body: "Votre mot de passe a été modifié avec succès.",
          p_type: "password_reset_success",
          p_data: null,
        });
      }
      return {};
    },
    [session, loadProfile]
  );

  const resetPasswordByPhone = useCallback(async (phone: string, newPassword: string) => {
    const { data, error } = await supabase.functions.invoke("reset-user-password", {
      body: { phone: phone.trim(), newPassword },
    });
    if (error) {
      return { error: mapAuthError(error.message) };
    }
    const payload = data as { error?: string; ok?: boolean } | null;
    if (payload?.error) return { error: mapAuthError(payload.error) };
    return {};
  }, []);

  const signOut = useCallback(async () => {
    explicitSignOutRef.current = true;
    void unsubscribeFromPush();
    clearSession();
    try {
      await supabase.auth.signOut();
    } catch {
      /* session déjà vidée côté UI */
    }
  }, [clearSession]);

  const refreshProfile = useCallback(async () => {
    if (!session?.user) return;
    await loadProfile(session.user, {
      silent: !!profile && profile.id === session.user.id,
      accessToken: session.access_token,
    });
  }, [session, profile, loadProfile]);

  const value = useMemo<AuthContextValue>(() => {
    const user = session?.user ?? null;
    const resolvedProfile = user
      ? profile?.id === user.id
        ? profile
        : profileFromUser(user)
      : null;
    const authReady = !loading && !profileLoading && (!user || resolvedProfile !== null);
    const role = resolvedProfile?.role ?? null;
    return {
      loading,
      profileLoading,
      authReady,
      session,
      user,
      profile: resolvedProfile,
      role,
      isAdmin: role === "admin",
      isDriver: role === "driver",
      isPassenger: role === "passenger",
      mustChangePassword: !!resolvedProfile?.must_change_password,
      signInWithPhone,
      signInWithEmail,
      signUpPassenger,
      createDriverAccount,
      changeOwnPassword,
      resetPasswordByPhone,
      signOut,
      refreshProfile,
    };
  }, [
    loading,
    profileLoading,
    session,
    profile,
    signInWithPhone,
    signInWithEmail,
    signUpPassenger,
    createDriverAccount,
    changeOwnPassword,
    resetPasswordByPhone,
    signOut,
    refreshProfile,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
