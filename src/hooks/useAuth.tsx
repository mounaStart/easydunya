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
import { App } from "@capacitor/app";
import { supabase } from "../lib/supabase";
import { phoneToEmail } from "../lib/phone";
import { mapAuthError } from "../lib/authErrors";
import { rebindPushToUser, unsubscribeFromPush } from "../lib/push";
import { isNativePlatform } from "../lib/nativePush";
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
  const initialAuthDoneRef = useRef(false);

  const loadProfile = useCallback(async (u: User) => {
    loadProfileForRef.current = u.id;
    setProfileLoading(true);
    setProfile((prev) => (prev?.id === u.id ? prev : null));

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", u.id)
        .maybeSingle();

      if (loadProfileForRef.current !== u.id) return;

      if (error) {
        setProfile(null);
        return;
      }

      if (data) {
        setProfile(data as Profile);
        return;
      }

      // Aucun profil → le créer (sinon les réservations échouent : FK passenger_id)
      const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
      const roleMeta = meta.role;
      const role: UserRole =
        roleMeta === "driver" || roleMeta === "admin" ? roleMeta : "passenger";
      const payload = {
        id: u.id,
        role,
        full_name: (meta.full_name as string) ?? null,
        phone: (meta.phone as string) ?? null,
        driver_status: role === "driver" ? "pending" : null,
      };
      const { data: created } = await supabase
        .from("profiles")
        .upsert(payload, { onConflict: "id" })
        .select()
        .maybeSingle();

      if (loadProfileForRef.current !== u.id) return;
      setProfile((created as Profile | null) ?? (payload as unknown as Profile));
    } finally {
      if (loadProfileForRef.current === u.id) {
        setProfileLoading(false);
      }
    }
  }, []);

  const applySession = useCallback(
    async (s: Session | null, event?: string) => {
      setSession(s);
      if (s?.user) {
        await loadProfile(s.user);
        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
          rebindPushToUser(s.user.id).catch(() => {});
        }
      } else {
        loadProfileForRef.current = null;
        setProfile(null);
        setProfileLoading(false);
      }
    },
    [loadProfile]
  );

  const refreshSessionFromStorage = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    await applySession(data.session);
  }, [applySession]);

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
      void applySession(data.session).finally(finishInitialLoad);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (evt, s) => {
      if (cancelled) return;
      if (evt === "INITIAL_SESSION") {
        finishInitialLoad();
        return;
      }
      await applySession(s, evt);
    });

    return () => {
      cancelled = true;
      window.clearTimeout(bootstrapTimeout);
      sub.subscription.unsubscribe();
    };
  }, [applySession]);

  useEffect(() => {
    if (isNativePlatform()) {
      const sub = App.addListener("appStateChange", ({ isActive }) => {
        if (isActive) void refreshSessionFromStorage();
      });
      return () => {
        void sub.then((handle) => handle.remove());
      };
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
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) return { error: error.message, code: error.code };
    return {};
  }, []);

  const signInWithPhone = useCallback(async (phone: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: phoneToEmail(phone),
      password,
    });
    if (error) return { error: error.message, code: error.code };
    return {};
  }, []);

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
            await loadProfile(data.session.user);
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
        await loadProfile(session.user);
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
    void unsubscribeFromPush();
    loadProfileForRef.current = null;
    setProfile(null);
    setProfileLoading(false);
    await supabase.auth.signOut();
    setSession(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (session?.user) await loadProfile(session.user);
  }, [session, loadProfile]);

  const value = useMemo<AuthContextValue>(() => {
    const user = session?.user ?? null;
    const profileMatchesUser = !user || profile?.id === user.id;
    const authReady =
      !loading &&
      !profileLoading &&
      profileMatchesUser &&
      (!user || profile !== null);
    const role = profileMatchesUser ? (profile?.role ?? null) : null;
    return {
      loading,
      profileLoading,
      authReady,
      session,
      user,
      profile: profileMatchesUser ? profile : null,
      role,
      isAdmin: role === "admin",
      isDriver: role === "driver",
      isPassenger: role === "passenger",
      mustChangePassword: !!profile?.must_change_password && profileMatchesUser,
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
