import { useEffect, useMemo } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../app/AuthProvider";
import { FullPageLoader } from "../../app/FullPageLoader";
import { homeFor } from "../../app/guards";
import { ButtonLink } from "../../ui";
import { AuthAlert } from "./AuthAlert";
import { AuthHeading, AuthLayout } from "./AuthLayout";
import { clearNextPath, peekNextPath } from "./authApi";

/**
 * Landing page for OAuth and email-confirmation redirects. The Supabase client
 * exchanges the one-time `?code=` during startup; this page then replaces the
 * URL so the code never stays in history.
 */
export default function AuthCallbackPage() {
  const { session, profile, loading, notice } = useAuth();
  const location = useLocation();

  const providerError = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const hash = new URLSearchParams(location.hash.replace(/^#/, ""));
    return params.get("error_description") ?? hash.get("error_description") ?? params.get("error") ?? hash.get("error");
  }, [location.search, location.hash]);

  const nextPath = useMemo(() => peekNextPath(), []);

  useEffect(() => {
    // Once the client has exchanged the code, drop code / error parameters from the address bar.
    if (!loading && (window.location.search || window.location.hash)) {
      window.history.replaceState(window.history.state, "", window.location.pathname);
    }
  }, [loading]);

  useEffect(() => {
    if (session && profile) clearNextPath();
  }, [session, profile]);

  if (loading || (session && !profile && !notice)) {
    return <FullPageLoader label="Signing you in…" />;
  }

  if (session && profile) {
    return <Navigate replace to={nextPath ?? homeFor(profile.role)} />;
  }

  return (
    <AuthLayout title="Sign in">
      <AuthHeading
        description={
          providerError
            ? "We couldn’t finish signing you in."
            : "If you just confirmed your email, your account is ready — sign in to continue."
        }
        eyebrow="Almost there"
        title={providerError ? "Sign-in didn’t finish" : "You’re all set"}
      />
      <div className="auth__form">
        {providerError && <AuthAlert tone="error">{providerError.replace(/\+/g, " ")}</AuthAlert>}
        {notice && <AuthAlert tone="info">{notice}</AuthAlert>}
        <ButtonLink block size="lg" to="/sign-in">
          Go to sign in
        </ButtonLink>
      </div>
    </AuthLayout>
  );
}
