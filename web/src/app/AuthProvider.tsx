import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import type { Profile } from "../lib/models";
import { supabase } from "../lib/supabase";
import { takePendingAccountType } from "../features/auth/authApi";

type AuthContextValue = {
  session: Session | null;
  profile: Profile | null;
  /** True until the initial session and (if signed in) profile are known. */
  loading: boolean;
  /** A message for the sign-in screen, e.g. why the user was signed out. */
  notice: string | null;
  clearNotice: () => void;
  /** True while the session is a password-recovery session. */
  recovering: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const LEGACY_TOKEN_HASH = /(^|[#&])(access_token|refresh_token|provider_token)=/;

/**
 * After the client has exchanged it, drop the one-time PKCE `?code=` and any
 * legacy implicit-flow tokens in the hash so neither stays in browser history.
 * Error parameters are left for the callback page to show.
 */
function stripTokensFromUrl() {
  const url = new URL(window.location.href);
  const hadCode = url.searchParams.has("code");
  url.searchParams.delete("code");
  const hadTokenHash = LEGACY_TOKEN_HASH.test(url.hash);
  if (hadTokenHash) url.hash = "";
  if (hadCode || hadTokenHash) {
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  }
}

// The profile row is created by the on_auth_user_created trigger; give it a moment.
async function fetchProfile(userId: string) {
  if (!supabase) return null;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (error) throw error;
    if (data) {
      const profile = data as Profile;
      // Databases without the v2 roles migration still say "user".
      return (profile.role as string) === "user" ? { ...profile, role: "student" } : profile;
    }
    await new Promise((resolve) => window.setTimeout(resolve, 400));
  }
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [booting, setBooting] = useState(true);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    const client = supabase;
    if (!client) {
      setBooting(false);
      return;
    }

    let mounted = true;

    // getSession() waits for the PKCE `?code=` exchange when there is one.
    void client.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      stripTokensFromUrl();
      if (error) {
        setNotice(error.message);
      } else {
        setSession(data.session);
      }
      setBooting(false);
    });

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
      if (event === "SIGNED_OUT") setRecovering(false);
      setSession(nextSession);
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

  const loadProfile = useCallback(async (userId: string) => {
    const client = supabase;
    if (!client) return;

    let nextProfile = await fetchProfile(userId);
    if (!nextProfile) {
      throw new Error("Your account is still being set up. Please refresh in a moment.");
    }

    if (!nextProfile.is_active) {
      await client.auth.signOut();
      setSession(null);
      setProfile(null);
      setNotice("Your account is inactive. Please contact the MAPAGUAPA admin.");
      return;
    }

    // "I own a place" chosen before a Google sign-up.
    if (takePendingAccountType() === "owner" && nextProfile.role === "student") {
      const { error } = await client.rpc("become_owner");
      if (error) {
        setNotice(error.message);
      } else {
        nextProfile = (await fetchProfile(userId)) ?? nextProfile;
      }
    }

    setProfile(nextProfile);
    // Best effort; older databases don't have this RPC.
    void client.rpc("touch_last_active").then(() => undefined, () => undefined);
  }, []);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) {
      setProfile(null);
      setLoadingProfile(false);
      return;
    }

    let cancelled = false;
    setLoadingProfile(true);
    loadProfile(userId)
      .catch((error: unknown) => {
        if (!cancelled) setNotice(error instanceof Error ? error.message : "Failed to load your profile.");
      })
      .finally(() => {
        if (!cancelled) setLoadingProfile(false);
      });

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id, loadProfile]);

  const refreshProfile = useCallback(async () => {
    if (session?.user?.id) await loadProfile(session.user.id);
  }, [loadProfile, session?.user?.id]);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) {
      setNotice(error.message);
      return;
    }
    setSession(null);
    setProfile(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      profile,
      loading: booting || (Boolean(session) && loadingProfile && !profile),
      notice,
      clearNotice: () => setNotice(null),
      recovering,
      refreshProfile,
      signOut,
    }),
    [session, profile, booting, loadingProfile, notice, recovering, refreshProfile, signOut]
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
