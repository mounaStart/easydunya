import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createClient, type Session, type User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { phoneToEmail } from "../lib/phone";
import { rebindPushToUser, unsubscribeFromPush } from "../lib/push";
import type { Profile, UserRole } from "../lib/types";

const SUPA_URL = (import.meta.env.VITE_SUPABASE_URL as string) ?? "http://localhost:8000";
const SUPA_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) ?? "missing-anon-key";

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
  /** Passager / chauffeur : connexion par téléphone + mot de passe */
  signInWithPhone: (
    phone: string,
    password: string
  ) => Promise<{ error?: string; code?: string }>;
  /** Admin : connexion par email + mot de passe (inchangé) */
  signInWithEmail: (
    email: string,
    password: string
  ) => Promise<{ error?: string; code?: string }>;
  /** Inscription passager : nom + téléphone + mot de passe */
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
      // Unicité du téléphone
      const { data: taken } = await supabase.rpc("is_phone_taken", {
        p_phone: trimmedPhone,
      });
      if (taken === true) {
        return { error: "Ce numéro de téléphone est déjà utilisé." };
      }

      const { data, error } = await supabase.auth.signUp({
        email: phoneToEmail(trimmedPhone),
        password,
        options: {
          data: { full_name: fullName, phone: trimmedPhone, role: "passenger" },
        },
      });
      if (error) return { error: error.message };

      // Email déjà enregistré : Supabase renvoie un user avec identities vide.
      // On NE crée PAS et on N'ÉCRASE PAS le profil existant (sécurité admin).
      if (data.user && (data.user.identities?.length ?? 0) === 0) {
        return { error: "Ce numéro de téléphone est déjà utilisé." };
      }

      if (data.user) {
        // insert (pas upsert) : ne touche jamais un profil déjà présent
        await supabase.from("profiles").insert({
          id: data.user.id,
          role: "passenger",
          full_name: fullName,
          phone: trimmedPhone,
        });
        if (data.session?.user) await loadProfile(data.session.user);
      }
      return {};
    },
    [loadProfile]
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

      // Client jetable : crée le compte chauffeur SANS toucher la session admin.
      const tmp = createClient(SUPA_URL, SUPA_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data, error } = await tmp.auth.signUp({
        email: phoneToEmail(trimmedPhone),
        password,
        options: {
          data: { full_name: fullName, phone: trimmedPhone, role: "driver" },
        },
      });
      if (error) return { error: error.message };
      if (!data.user) return { error: "Création du compte échouée." };

      // Email déjà enregistré (identities vide) : ne pas écraser un compte existant
      if ((data.user.identities?.length ?? 0) === 0) {
        return { error: "Ce numéro de téléphone est déjà utilisé." };
      }

      // L'admin (session courante) complète le profil chauffeur :
      // approuvé d'office (créé par l'admin) + changement de mot de passe requis.
      const update: Record<string, unknown> = {
        role: "driver",
        full_name: fullName,
        phone: trimmedPhone,
        driver_status: "approved",
        must_change_password: true,
      };
      if (baseCityId) update.base_city_id = baseCityId;
      const { error: upErr } = await supabase
        .from("profiles")
        .update(update)
        .eq("id", data.user.id);
      if (upErr) return { error: upErr.message };

      // Véhicule du chauffeur (créé directement par l'admin)
      if (vehicleMake?.trim() && vehiclePlate?.trim()) {
        const { error: vErr } = await supabase.from("vehicles").insert({
          driver_id: data.user.id,
          make: vehicleMake.trim(),
          plate: vehiclePlate.trim(),
          seats: vehicleSeats && vehicleSeats > 0 ? vehicleSeats : 8,
          features: vehicleFeatures?.trim() || null,
        });
        if (vErr) return { error: vErr.message };
      }

      await tmp.auth.signOut();
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
      }
      return {};
    },
    [session, loadProfile]
  );

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
