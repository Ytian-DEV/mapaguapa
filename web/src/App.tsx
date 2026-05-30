import { useEffect, useState } from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import MapaguapaAdminPage from "./components/admin/MapaguapaAdminPage";
import MapaguapaAuthPage from "./components/auth/MapaguapaAuthPage";
import MapaguapaUserPage from "./components/user/MapaguapaUserPage";
import type { Database } from "./lib/database";
import type { Profile } from "./lib/models";
import { hasSupabaseEnv, supabase } from "./lib/supabase";
import "./app.css";

type Credentials = {
  email: string;
  password: string;
  fullName?: string;
};

type OAuthProvider = "google";

const profileSelect = "id, email, full_name, phone, avatar_url, role, is_active, created_at, updated_at";
const authRedirectTo = import.meta.env.VITE_AUTH_REDIRECT_URL?.trim();

async function fetchProfileWithRetry(client: SupabaseClient<Database>, userId: string) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data, error } = await client
      .from("profiles")
      .select(profileSelect)
      .eq("id", userId)
      .maybeSingle();

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

export default function App() {
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

    const bootstrap = async () => {
      const { data, error } = await client.auth.getSession();
      if (!mounted) {
        return;
      }

      if (error) {
        setAuthError(error.message);
        setBooting(false);
        return;
      }

      setSession(data.session);
      setBooting(false);
    };

    void bootstrap();

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) {
        return;
      }

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
    if (!client) {
      return;
    }

    if (!session?.user?.id) {
      setProfile(null);
      setLoadingProfile(false);
      return;
    }

    let cancelled = false;
    setLoadingProfile(true);

    void fetchProfileWithRetry(client, session.user.id)
      .then((nextProfile) => {
        if (!cancelled) {
          setProfile(nextProfile);
        }
      })
      .catch((profileError) => {
        if (!cancelled) {
          setAuthError(profileError instanceof Error ? profileError.message : "Failed to load profile.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingProfile(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  const getFriendlyAuthError = (message: string) => {
    const normalizedMessage = message.toLowerCase();

    if (normalizedMessage.includes("email not confirmed")) {
      return "Please confirm your email using the link we sent before logging in.";
    }

    return message;
  };

  const handleLogin = async ({ email, password }: Credentials) => {
    const client = supabase;
    if (!client) {
      return;
    }

    setSubmitting(true);
    setAuthError(null);
    setAuthInfo(null);

    const { error } = await client.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setAuthError(getFriendlyAuthError(error.message));
    }

    setSubmitting(false);
  };

  const handleSignup = async ({ email, password, fullName }: Credentials) => {
    const client = supabase;
    if (!client) {
      return false;
    }

    setSubmitting(true);
    setAuthError(null);
    setAuthInfo(null);

    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (error) {
      setAuthError(getFriendlyAuthError(error.message));
      setSubmitting(false);
      return false;
    } else if (!data.session) {
      setAuthInfo("Account created. Check your email to confirm before signing in.");
    } else {
      setAuthInfo("Account created successfully.");
    }

    setSubmitting(false);
    return true;
  };

  const handleOAuthLogin = async (provider: OAuthProvider) => {
    const client = supabase;
    if (!client) {
      return;
    }

    setSubmitting(true);
    setAuthError(null);
    setAuthInfo(null);

    const { error } = await client.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: authRedirectTo || `${window.location.origin}/dashboard`,
      },
    });

    if (error) {
      setAuthError(getFriendlyAuthError(error.message));
      setSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    const client = supabase;
    if (!client) {
      return;
    }

    const { error } = await client.auth.signOut();
    if (error) {
      setAuthError(error.message);
      return;
    }

    setSession(null);
    setProfile(null);
    setAuthInfo(null);
  };

  if (booting || (session && loadingProfile && !profile)) {
    return <div className="app-shell app-shell--loading">Loading MAPAGUAPA...</div>;
  }

  if (!session || !profile) {
    return (
      <MapaguapaAuthPage
        authConfigured={hasSupabaseEnv}
        authError={authError}
        authInfo={authInfo}
        isSubmitting={submitting}
        onLogin={handleLogin}
        onOAuthLogin={handleOAuthLogin}
        onSignup={handleSignup}
      />
    );
  }

  return profile.role === "admin" ? (
    <MapaguapaAdminPage onSignOut={handleSignOut} profile={profile} />
  ) : (
    <MapaguapaUserPage onSignOut={handleSignOut} profile={profile} />
  );
}
