import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./app/AuthProvider";
import { FullPageLoader } from "./app/FullPageLoader";
import { homeFor, PublicOnly, RequireRole } from "./app/guards";
import { SavedProvider } from "./features/browse/SavedContext";
import { StudentShell } from "./features/browse/StudentShell";
import { InboxProvider } from "./features/messaging/InboxContext";
import { OwnerShell } from "./features/owner/OwnerShell";
import { ToastProvider } from "./ui";
import "./app.css";

const MapaguapaAdminPage = lazy(() => import("./components/admin/MapaguapaAdminPage"));
const AboutPage = lazy(() => import("./components/shared/AboutPage"));
const BrowsePage = lazy(() => import("./features/browse/BrowsePage"));
const SavedPage = lazy(() => import("./features/browse/SavedPage"));
const MapPage = lazy(() => import("./features/map/MapPage"));
const StudentMessagesPage = lazy(() => import("./features/messaging/StudentMessagesPage"));
const ListingDetailPage = lazy(() => import("./features/listing/ListingDetailPage"));
const SignInPage = lazy(() => import("./features/auth/SignInPage"));
const SignUpPage = lazy(() => import("./features/auth/SignUpPage"));
const ForgotPasswordPage = lazy(() => import("./features/auth/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./features/auth/ResetPasswordPage"));
const AuthCallbackPage = lazy(() => import("./features/auth/AuthCallbackPage"));
const OwnerComingSoon = lazy(() => import("./features/owner/OwnerComingSoon"));
const OwnerInquiriesPage = lazy(() => import("./features/messaging/OwnerInquiriesPage"));
const NotFoundPage = lazy(() => import("./app/NotFoundPage"));
const ComponentsPreview = import.meta.env.DEV ? lazy(() => import("./dev/ComponentsPreview")) : null;
const BrowsePreview = import.meta.env.DEV ? lazy(() => import("./dev/BrowsePreview")) : null;
const ListingPreview = import.meta.env.DEV ? lazy(() => import("./dev/ListingPreview")) : null;

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

/** Student area: shared nav, footer and saved state. */
function StudentLayout() {
  return (
    <RequireRole roles={["student"]}>
      <SavedProvider>
        <InboxProvider>
          <StudentShell>
            <Suspense fallback={null}>
              <Outlet />
            </Suspense>
          </StudentShell>
        </InboxProvider>
      </SavedProvider>
    </RequireRole>
  );
}

/** Owner area: sidebar with unread inquiries. */
function OwnerLayout() {
  return (
    <RequireRole roles={["owner"]}>
      <InboxProvider>
        <OwnerShell>
          <Suspense fallback={null}>
            <Outlet />
          </Suspense>
        </OwnerShell>
      </InboxProvider>
    </RequireRole>
  );
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

              <Route element={<StudentLayout />}>
                <Route element={<BrowsePage />} path="/" />
                <Route element={<SavedPage />} path="/saved" />
                <Route element={<MapPage />} path="/map" />
                <Route element={<StudentMessagesPage />} path="/messages" />
                <Route element={<StudentMessagesPage />} path="/messages/:conversationId" />
                <Route element={<ListingDetailPage />} path="/listing/:listingId" />
              </Route>
              <Route element={<Navigate replace to="/saved" />} path="/dashboard/saved" />
              <Route element={<LegacyDashboardRedirect />} path="/dashboard" />
              <Route element={<OwnerLayout />} path="/owner">
                <Route element={<OwnerComingSoon />} index />
                <Route element={<OwnerInquiriesPage />} path="inquiries" />
                <Route element={<OwnerInquiriesPage />} path="inquiries/:conversationId" />
                <Route element={<OwnerComingSoon />} path="*" />
              </Route>
              <Route element={<RequireRole roles={["admin"]}><AdminRoute /></RequireRole>} path="/admin/*" />

              {ComponentsPreview && <Route element={<ComponentsPreview />} path="/dev/components" />}
              {BrowsePreview && <Route element={<BrowsePreview />} path="/dev/browse" />}
              {ListingPreview && <Route element={<ListingPreview />} path="/dev/listing" />}
              <Route element={<NotFoundPage />} path="*" />
            </Routes>
          </Suspense>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
