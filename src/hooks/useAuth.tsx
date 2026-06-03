import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
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
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (params: {
    email: string;
    password: string;
    fullName: string;
    phone: string;
    role: UserRole;
    licenseNumber?: string;
    baseCityId?: string;
  }) => Promise<{ error?: string; needsEmailConfirm?: boolean }>;
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
      if (data.session?.user) await loadProfile(data.session.user);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_evt, s) => {
      setSession(s);
      if (s?.user) {
        await loadProfile(s.user);
      } else {
        setProfile(null);
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return {};
  }, []);

  const signUp = useCallback(
    async ({
      email,
      password,
      fullName,
      phone,
      role,
      licenseNumber,
      baseCityId,
    }: {
      email: string;
      password: string;
      fullName: string;
      phone: string;
      role: UserRole;
      licenseNumber?: string;
      baseCityId?: string;
    }) => {
      // 1) Vérifier l'unicité du téléphone (lecture publique des profils chauffeurs autorisée,
      // pour les passagers cette requête peut échouer silencieusement par RLS — on fait au mieux)
      const trimmedPhone = phone.trim();
      if (trimmedPhone) {
        const { data: taken, error: phoneErr } = await supabase.rpc(
          "is_phone_taken",
          { p_phone: trimmedPhone }
        );
        if (!phoneErr && taken === true) {
          return { error: "Ce numéro de téléphone est déjà utilisé." };
        }
      }

      // 2) Création du compte Auth
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName, phone: trimmedPhone, role },
        },
      });
      if (error) return { error: error.message };

      // 3) S'assurer que le profil est à jour (role / phone / name + champs chauffeur)
      if (data.user) {
        const profilePayload: Record<string, unknown> = {
          id: data.user.id,
          role,
          full_name: fullName,
          phone: trimmedPhone,
          driver_status: role === "driver" ? "pending" : null,
        };
        if (role === "driver") {
          if (licenseNumber) profilePayload.license_number = licenseNumber;
          if (baseCityId) profilePayload.base_city_id = baseCityId;
        }
        await supabase
          .from("profiles")
          .upsert(profilePayload, { onConflict: "id" });
        await loadProfile(data.user);
      }

      // 4) Détecter "confirmation email requise" : Supabase renvoie un user
      // mais pas de session tant que l'email n'est pas confirmé.
      const needsEmailConfirm = !!data.user && !data.session;
      return { needsEmailConfirm };
    },
    [loadProfile]
  );

  const signOut = useCallback(async () => {
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
      signIn,
      signUp,
      signOut,
      refreshProfile,
    };
  }, [loading, session, profile, signIn, signUp, signOut, refreshProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
