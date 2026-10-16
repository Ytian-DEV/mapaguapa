import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./app/AuthProvider";
import { FullPageLoader } from "./app/FullPageLoader";
import { homeFor, RequireRole } from "./app/guards";
import { hasSupabaseEnv } from "./lib/supabase";
import { ToastProvider } from "./ui";
import "./app.css";

const MapaguapaAdminPage = lazy(() => import("./components/admin/MapaguapaAdminPage"));
const MapaguapaAuthPage = lazy(() => import("./components/auth/MapaguapaAuthPage"));
const MapaguapaUserPage = lazy(() => import("./components/user/MapaguapaUserPage"));
const AboutPage = lazy(() => import("./components/shared/AboutPage"));
const ComponentsPreview = import.meta.env.DEV ? lazy(() => import("./dev/ComponentsPreview")) : null;

function AboutRoute() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  return <AboutPage onLogoClick={() => navigate(profile ? homeFor(profile.role) : "/")} />;
}

function AdminRoute() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  if (!profile) return null;
  return <MapaguapaAdminPage onNavigateAbout={() => navigate("/about")} onSignOut={signOut} profile={profile} />;
}

/** v1 entry: auth page when signed out, student catalog when signed in. Replaced in features 3–6. */
function HomeRoute() {
  const auth = useAuth();
  const navigate = useNavigate();

  if (auth.loading) {
    return <FullPageLoader />;
  }

  if (!auth.session || !auth.profile) {
    return (
      <MapaguapaAuthPage
        authConfigured={hasSupabaseEnv}
        authError={auth.authError}
        authInfo={auth.authInfo}
        isSubmitting={auth.submitting}
        onLogin={auth.login}
        onNavigateAbout={() => navigate("/about")}
        onOAuthLogin={auth.loginWithOAuth}
        onPasswordReset={auth.resetPassword}
        onSignup={auth.signup}
      />
    );
  }

  if (auth.profile.role === "admin") {
    return <Navigate replace to="/admin" />;
  }

  return <MapaguapaUserPage onNavigateAbout={() => navigate("/about")} onSignOut={auth.signOut} profile={auth.profile} />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Suspense fallback={<FullPageLoader />}>
            <Routes>
              <Route element={<AboutRoute />} path="/about" />
              <Route
                element={
                  <RequireRole roles={["admin"]}>
                    <AdminRoute />
                  </RequireRole>
                }
                path="/admin/*"
              />
              {ComponentsPreview && <Route element={<ComponentsPreview />} path="/dev/components" />}
              {/* "*" also covers /dashboard, the v1 OAuth redirect target: the token hash must stay intact until feature 3 moves auth to PKCE. */}
              <Route element={<HomeRoute />} path="*" />
            </Routes>
          </Suspense>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
