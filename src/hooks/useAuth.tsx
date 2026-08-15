import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { type Session, type User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { phoneToEmail } from "../lib/phone";
import { mapAuthError } from "../lib/authErrors";
import { rebindPushToUser, unsubscribeFromPush } from "../lib/push";
import type { Profile, UserRole } from "../lib/types";

interface AuthContextValue {
  loading: boolean;
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
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const loadProfile = useCallback(async (u: User) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", u.id)
      .maybeSingle();
    if (error) return;
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
    setProfile((created as Profile | null) ?? (payload as unknown as Profile));
  }, []);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      if (data.session?.user) {
        await loadProfile(data.session.user);
        rebindPushToUser(data.session.user.id).catch(() => {});
      }
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (evt, s) => {
      setSession(s);
      if (s?.user) {
        await loadProfile(s.user);
        // Réassocie le push à ce compte (même téléphone, autre utilisateur)
        if (evt === "SIGNED_IN" || evt === "TOKEN_REFRESHED") {
          rebindPushToUser(s.user.id).catch(() => {});
        }
      } else {
        setProfile(null);
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

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
        void supabase.functions.invoke("send-fcm", {
          body: {
            user_id: session.user.id,
            title: "Mot de passe réinitialisé ✓",
            body: "Votre mot de passe a été modifié avec succès.",
            type: "password_reset_success",
            data: { push_only: "true" },
          },
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
    await supabase.auth.signOut();
    setProfile(null);
    setSession(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (session?.user) await loadProfile(session.user);
  }, [session, loadProfile]);

  const value = useMemo<AuthContextValue>(() => {
    const role = profile?.role ?? null;
    return {
      loading,
      session,
      user: session?.user ?? null,
      profile,
      role,
      isAdmin: role === "admin",
      isDriver: role === "driver",
      isPassenger: role === "passenger",
      mustChangePassword: !!profile?.must_change_password,
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
