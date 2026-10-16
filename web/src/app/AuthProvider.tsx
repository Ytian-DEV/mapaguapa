import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../lib/database";
import type { Profile } from "../lib/models";
import { supabase } from "../lib/supabase";

type Credentials = {
  email: string;
  password: string;
  fullName?: string;
};

type OAuthProvider = "google";

type AuthContextValue = {
  session: Session | null;
  profile: Profile | null;
  /** True until the initial session and (if signed in) profile are known. */
  loading: boolean;
  submitting: boolean;
  authError: string | null;
  authInfo: string | null;
  login: (credentials: Credentials) => Promise<void>;
  signup: (credentials: Credentials) => Promise<boolean>;
  loginWithOAuth: (provider: OAuthProvider) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const profileSelect = "id, email, full_name, phone, avatar_url, role, is_active, created_at, updated_at";
const authRedirectTo = import.meta.env.VITE_AUTH_REDIRECT_URL?.trim();
const passwordResetRedirectTo = import.meta.env.VITE_PASSWORD_RESET_REDIRECT_URL?.trim();

async function fetchProfileWithRetry(client: SupabaseClient<Database>, userId: string) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data, error } = await client.from("profiles").select(profileSelect).eq("id", userId).maybeSingle();

    if (error) {
      throw error;
    }

    if (data) {
      return data as Profile;
    }

    await new Promise((resolve) => window.setTimeout(resolve, 300));
  }

  return null;
}

async function ensureProfile(client: SupabaseClient<Database>, session: Session) {
  const existingProfile = await fetchProfileWithRetry(client, session.user.id);
  if (existingProfile) {
    return existingProfile;
  }

  const metadata = session.user.user_metadata;
  const fullName =
    typeof metadata.full_name === "string" ? metadata.full_name : typeof metadata.name === "string" ? metadata.name : null;
  const avatarUrl = typeof metadata.avatar_url === "string" ? metadata.avatar_url : null;

  const { data, error } = await ((client.from("profiles") as any)
    .insert({
      id: session.user.id,
      email: session.user.email ?? null,
      full_name: fullName,
      avatar_url: avatarUrl,
      role: "student",
      is_active: true,
    })
    .select(profileSelect)
    .single());

  if (error) {
    throw error;
  }

  return data as Profile;
}

function getFriendlyAuthError(message: string) {
  if (message.toLowerCase().includes("email not confirmed")) {
    return "Please confirm your email using the link we sent before logging in.";
  }
  return message;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [booting, setBooting] = useState(true);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authInfo, setAuthInfo] = useState<string | null>(null);

  useEffect(() => {
    const client = supabase;
    if (!client) {
      setBooting(false);
      return;
    }

    let mounted = true;

    void client.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) {
        setAuthError(error.message);
      } else {
        setSession(data.session);
      }
      setBooting(false);
    });

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setAuthError(null);
      if (!nextSession) {
        setProfile(null);
        setLoadingProfile(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const client = supabase;
    if (!client) return;

    if (!session?.user?.id) {
      setProfile(null);
      setLoadingProfile(false);
      return;
    }

    let cancelled = false;
    setLoadingProfile(true);

    void ensureProfile(client, session)
      .then((nextProfile) => {
        if (cancelled) return;

        if (!nextProfile.is_active) {
          void client.auth.signOut();
          setSession(null);
          setProfile(null);
          setAuthError("Your account is inactive. Please contact the MAPAGUAPA admin.");
          return;
        }

        setProfile(nextProfile);
      })
      .catch((profileError) => {
        if (!cancelled) {
          setAuthError(profileError instanceof Error ? profileError.message : "Failed to load profile.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingProfile(false);
      });

    return () => {
      cancelled = true;
    };
    // Only re-run when the signed-in user changes, not on token refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  const run = useCallback(async <T,>(action: () => Promise<T>) => {
    setSubmitting(true);
    setAuthError(null);
    setAuthInfo(null);
    try {
      return await action();
    } finally {
      setSubmitting(false);
    }
  }, []);

  const login = useCallback(
    (credentials: Credentials) =>
      run(async () => {
        if (!supabase) return;
        const { error } = await supabase.auth.signInWithPassword({ email: credentials.email, password: credentials.password });
        if (error) setAuthError(getFriendlyAuthError(error.message));
      }),
    [run]
  );

  const signup = useCallback(
    (credentials: Credentials) =>
      run(async () => {
        if (!supabase) return false;
        const { data, error } = await supabase.auth.signUp({
          email: credentials.email,
          password: credentials.password,
          options: { data: { full_name: credentials.fullName } },
        });
        if (error) {
          setAuthError(getFriendlyAuthError(error.message));
          return false;
        }
        setAuthInfo(data.session ? "Account created successfully." : "Account created. Check your email to confirm before signing in.");
        return true;
      }),
    [run]
  );

  const loginWithOAuth = useCallback(
    (provider: OAuthProvider) =>
      run(async () => {
        if (!supabase) return;
        const { error } = await supabase.auth.signInWithOAuth({
          provider,
          options: { redirectTo: authRedirectTo || `${window.location.origin}/dashboard` },
        });
        if (error) setAuthError(getFriendlyAuthError(error.message));
      }),
    [run]
  );

  const resetPassword = useCallback(
    (email: string) =>
      run(async () => {
        if (!supabase) return;
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: passwordResetRedirectTo || `${window.location.origin}/dashboard`,
        });
        if (error) {
          setAuthError(getFriendlyAuthError(error.message));
        } else {
          setAuthInfo("Password reset email sent. Check your inbox for the reset link.");
        }
      }),
    [run]
  );

  const signOut = useCallback(async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) {
      setAuthError(error.message);
      return;
    }
    setSession(null);
    setProfile(null);
    setAuthInfo(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      profile,
      loading: booting || (Boolean(session) && loadingProfile && !profile),
      submitting,
      authError,
      authInfo,
      login,
      signup,
      loginWithOAuth,
      resetPassword,
      signOut,
    }),
    [session, profile, booting, loadingProfile, submitting, authError, authInfo, login, signup, loginWithOAuth, resetPassword, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside <AuthProvider>.");
  }
  return context;
}
