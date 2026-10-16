import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./app/AuthProvider";
import { FullPageLoader } from "./app/FullPageLoader";
import { homeFor, PublicOnly, RequireRole } from "./app/guards";
import { ToastProvider } from "./ui";
import "./app.css";

const MapaguapaAdminPage = lazy(() => import("./components/admin/MapaguapaAdminPage"));
const MapaguapaUserPage = lazy(() => import("./components/user/MapaguapaUserPage"));
const AboutPage = lazy(() => import("./components/shared/AboutPage"));
const SignInPage = lazy(() => import("./features/auth/SignInPage"));
const SignUpPage = lazy(() => import("./features/auth/SignUpPage"));
const ForgotPasswordPage = lazy(() => import("./features/auth/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./features/auth/ResetPasswordPage"));
const AuthCallbackPage = lazy(() => import("./features/auth/AuthCallbackPage"));
const OwnerComingSoon = lazy(() => import("./features/owner/OwnerComingSoon"));
const NotFoundPage = lazy(() => import("./app/NotFoundPage"));
const ComponentsPreview = import.meta.env.DEV ? lazy(() => import("./dev/ComponentsPreview")) : null;

function AboutRoute() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  return <AboutPage onLogoClick={() => navigate(profile ? homeFor(profile.role) : "/sign-in")} />;
}

function AdminRoute() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  if (!profile) return null;
  return <MapaguapaAdminPage onNavigateAbout={() => navigate("/about")} onSignOut={signOut} profile={profile} />;
}

/** v1 student catalog; replaced by the v2 browse and listing pages in features 4–6. */
function StudentRoute() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  if (!profile) return null;
  return <MapaguapaUserPage onNavigateAbout={() => navigate("/about")} onSignOut={signOut} profile={profile} />;
}

/** v1 sent OAuth and reset links to /dashboard; send any that still arrive with a code to the callback. */
function LegacyDashboardRedirect() {
  const location = useLocation();
  const target = new URLSearchParams(location.search).has("code") ? `/auth/callback${location.search}` : "/";
  return <Navigate replace to={target} />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Suspense fallback={<FullPageLoader />}>
            <Routes>
              <Route element={<PublicOnly><SignInPage /></PublicOnly>} path="/sign-in" />
              <Route element={<PublicOnly><SignUpPage /></PublicOnly>} path="/sign-up" />
              <Route element={<PublicOnly><ForgotPasswordPage /></PublicOnly>} path="/forgot-password" />
              <Route element={<ResetPasswordPage />} path="/reset-password" />
              <Route element={<AuthCallbackPage />} path="/auth/callback" />
              <Route element={<AboutRoute />} path="/about" />

              <Route element={<RequireRole roles={["student"]}><StudentRoute /></RequireRole>} path="/" />
              <Route element={<RequireRole roles={["student"]}><StudentRoute /></RequireRole>} path="/dashboard/saved" />
              <Route element={<LegacyDashboardRedirect />} path="/dashboard" />
              <Route element={<RequireRole roles={["owner"]}><OwnerComingSoon /></RequireRole>} path="/owner/*" />
              <Route element={<RequireRole roles={["admin"]}><AdminRoute /></RequireRole>} path="/admin/*" />

              {ComponentsPreview && <Route element={<ComponentsPreview />} path="/dev/components" />}
              <Route element={<NotFoundPage />} path="*" />
            </Routes>
          </Suspense>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
