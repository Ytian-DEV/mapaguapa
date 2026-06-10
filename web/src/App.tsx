import { lazy, Suspense, useEffect, useState } from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./lib/database";
import type { Profile } from "./lib/models";
import { hasSupabaseEnv, supabase } from "./lib/supabase";
import "./app.css";

const MapaguapaAdminPage = lazy(() => import("./components/admin/MapaguapaAdminPage"));
const MapaguapaAuthPage = lazy(() => import("./components/auth/MapaguapaAuthPage"));
const MapaguapaUserPage = lazy(() => import("./components/user/MapaguapaUserPage"));
const AboutPage = lazy(() => import("./components/shared/AboutPage"));

type Credentials = {
  email: string;
  password: string;
  fullName?: string;
};

type OAuthProvider = "google";

const profileSelect = "id, email, full_name, phone, avatar_url, role, is_active, created_at, updated_at";
const authRedirectTo = import.meta.env.VITE_AUTH_REDIRECT_URL?.trim();
const passwordResetRedirectTo = import.meta.env.VITE_PASSWORD_RESET_REDIRECT_URL?.trim();

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

async function ensureProfile(client: SupabaseClient<Database>, session: Session) {
  const existingProfile = await fetchProfileWithRetry(client, session.user.id);
  if (existingProfile) {
    return existingProfile;
  }

  const metadata = session.user.user_metadata;
  const fullName =
    typeof metadata.full_name === "string"
      ? metadata.full_name
      : typeof metadata.name === "string"
        ? metadata.name
        : null;
  const avatarUrl = typeof metadata.avatar_url === "string" ? metadata.avatar_url : null;

  const { data, error } = await ((client.from("profiles") as any)
    .insert({
      id: session.user.id,
      email: session.user.email ?? null,
      full_name: fullName,
      avatar_url: avatarUrl,
      role: "user",
      is_active: true,
    })
    .select(profileSelect)
    .single());

  if (error) {
    throw error;
  }

  return data as Profile;
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [booting, setBooting] = useState(true);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authInfo, setAuthInfo] = useState<string | null>(null);
  const [pathname, setPathname] = useState(window.location.pathname);

  useEffect(() => {
    const handlePopState = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigate = (path: string) => {
    if (window.location.pathname !== path) {
      window.history.pushState(null, "", path);
    }
    setPathname(path);
  };

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

    void ensureProfile(client, session)
      .then((nextProfile) => {
        if (cancelled) {
          return;
        }

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

  const handlePasswordReset = async (email: string) => {
    const client = supabase;
    if (!client) {
      return;
    }

    setSubmitting(true);
    setAuthError(null);
    setAuthInfo(null);

    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: passwordResetRedirectTo || `${window.location.origin}/dashboard`,
    });

    if (error) {
      setAuthError(getFriendlyAuthError(error.message));
    } else {
      setAuthInfo("Password reset email sent. Check your inbox for the reset link.");
    }

    setSubmitting(false);
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

  if (pathname === "/about") {
    return (
      <Suspense fallback={<div className="app-shell app-shell--loading">Loading MAPAGUAPA...</div>}>
        <AboutPage
          onLogoClick={() => {
            if (profile?.role === "admin") {
              navigate("/admin");
            } else if (profile) {
              navigate("/dashboard");
            } else {
              navigate("/");
            }
          }}
        />
      </Suspense>
    );
  }

  if (!session || !profile) {
    return (
      <Suspense fallback={<div className="app-shell app-shell--loading">Loading MAPAGUAPA...</div>}>
        <MapaguapaAuthPage
          authConfigured={hasSupabaseEnv}
          authError={authError}
          authInfo={authInfo}
          isSubmitting={submitting}
          onLogin={handleLogin}
          onOAuthLogin={handleOAuthLogin}
          onNavigateAbout={() => navigate("/about")}
          onPasswordReset={handlePasswordReset}
          onSignup={handleSignup}
        />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<div className="app-shell app-shell--loading">Loading MAPAGUAPA...</div>}>
      {profile.role === "admin" ? (
        <MapaguapaAdminPage onNavigateAbout={() => navigate("/about")} onSignOut={handleSignOut} profile={profile} />
      ) : (
        <MapaguapaUserPage onNavigateAbout={() => navigate("/about")} onSignOut={handleSignOut} profile={profile} />
      )}
    </Suspense>
  );
}
