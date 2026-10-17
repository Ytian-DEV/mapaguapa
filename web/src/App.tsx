import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./app/AuthProvider";
import { FullPageLoader } from "./app/FullPageLoader";
import { homeFor, PublicOnly, RequireRole } from "./app/guards";
import { SavedProvider } from "./features/browse/SavedContext";
import { StudentShell } from "./features/browse/StudentShell";
import { InboxProvider } from "./features/messaging/InboxContext";
import { AdminDataProvider, useAdminData } from "./features/admin/AdminDataContext";
import { AdminShell } from "./features/admin/AdminShell";
import { OwnerDataProvider } from "./features/owner/OwnerDataContext";
import { OwnerShell } from "./features/owner/OwnerShell";
import { ToastProvider } from "./ui";
import "./app.css";

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
const OwnerOverviewPage = lazy(() => import("./features/owner/OwnerOverviewPage"));
const OwnerListingsPage = lazy(() => import("./features/owner/OwnerListingsPage"));
const OwnerListingPreviewPage = lazy(() => import("./features/owner/OwnerListingPreviewPage"));
const VerificationPage = lazy(() => import("./features/owner/VerificationPage"));
const OwnerProfilePage = lazy(() => import("./features/owner/OwnerProfilePage"));
const WizardPage = lazy(() => import("./features/wizard/WizardPage"));
const AdminOverviewPage = lazy(() => import("./features/admin/AdminOverviewPage"));
const AdminSettingsPage = lazy(() => import("./features/admin/AdminSettingsPage"));
const AdminComingSoon = lazy(() => import("./features/admin/AdminComingSoon"));
const AdminReviewPage = lazy(() => import("./features/admin/AdminReviewPage"));
const AdminUsersPage = lazy(() => import("./features/admin/AdminUsersPage"));
const AdminReportsPage = lazy(() => import("./features/admin/AdminReportsPage"));
const AdminListingsPage = lazy(() => import("./features/admin/AdminListingsPage"));
const NotFoundPage = lazy(() => import("./app/NotFoundPage"));
const ComponentsPreview = import.meta.env.DEV ? lazy(() => import("./dev/ComponentsPreview")) : null;
const BrowsePreview = import.meta.env.DEV ? lazy(() => import("./dev/BrowsePreview")) : null;
const ListingPreview = import.meta.env.DEV ? lazy(() => import("./dev/ListingPreview")) : null;
const MessagesPreview = import.meta.env.DEV ? lazy(() => import("./dev/MessagesPreview")) : null;
const OwnerPreview = import.meta.env.DEV ? lazy(() => import("./dev/OwnerPreview")) : null;
const WizardPreview = import.meta.env.DEV ? lazy(() => import("./dev/WizardPreview")) : null;
const AdminPreview = import.meta.env.DEV ? lazy(() => import("./dev/AdminPreview")) : null;
const AdminListingsPreview = import.meta.env.DEV ? lazy(() => import("./dev/AdminListingsPreview")) : null;
const AdminReviewPreview = import.meta.env.DEV ? lazy(() => import("./dev/AdminReviewPreview")) : null;
const AdminUsersPreview = import.meta.env.DEV ? lazy(() => import("./dev/AdminUsersPreview")) : null;
const AdminReportsPreview = import.meta.env.DEV ? lazy(() => import("./dev/AdminReportsPreview")) : null;

function AboutRoute() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  return <AboutPage onLogoClick={() => navigate(profile ? homeFor(profile.role) : "/sign-in")} />;
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
        <OwnerDataProvider>
          <OwnerShell>
            <Suspense fallback={null}>
              <Outlet />
            </Suspense>
          </OwnerShell>
        </OwnerDataProvider>
      </InboxProvider>
    </RequireRole>
  );
}

function AdminFrame() {
  const { overview } = useAdminData();
  return (
    <AdminShell overview={overview}>
      <Suspense fallback={null}>
        <Outlet />
      </Suspense>
    </AdminShell>
  );
}

/** Admin console: sidebar with live counts. */
function AdminLayout() {
  return (
    <RequireRole roles={["admin"]}>
      <AdminDataProvider>
        <AdminFrame />
      </AdminDataProvider>
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
                <Route element={<OwnerOverviewPage />} index />
                <Route element={<OwnerListingsPage />} path="listings" />
                <Route element={<OwnerListingPreviewPage />} path="listings/:listingId/preview" />
                <Route element={<Navigate replace to="/owner/listings/new/edit/basics" />} path="listings/new" />
                <Route element={<WizardPage mode="owner" />} path="listings/:listingId/edit/:step?" />
                <Route element={<VerificationPage />} path="verification" />
                <Route element={<OwnerProfilePage />} path="profile" />
                <Route element={<OwnerInquiriesPage />} path="inquiries" />
                <Route element={<OwnerInquiriesPage />} path="inquiries/:conversationId" />
                <Route element={<OwnerComingSoon />} path="*" />
              </Route>
              {/* The v1 console stays reachable until features 11–13 replace it. */}
              <Route element={<AdminLayout />} path="/admin">
                <Route element={<AdminOverviewPage />} index />
                <Route element={<Navigate replace to="/admin/listings/new/edit/basics" />} path="listings/new" />
                <Route element={<WizardPage mode="admin" />} path="listings/:listingId/edit/:step?" />
                <Route element={<AdminReviewPage />} path="review" />
                <Route element={<AdminReviewPage />} path="review/:listingId" />
                <Route element={<AdminListingsPage />} path="listings" />
                <Route element={<OwnerListingPreviewPage base="/admin" />} path="listings/:listingId/preview" />
                <Route element={<AdminListingsPage initialTab="archived" />} path="archive" />
                <Route element={<AdminUsersPage />} path="users" />
                <Route element={<AdminReportsPage />} path="reports" />
                <Route element={<AdminReportsPage />} path="reports/:reportId" />
                <Route element={<AdminSettingsPage />} path="settings" />
                <Route element={<AdminComingSoon title="Page" />} path="*" />
              </Route>

              {ComponentsPreview && <Route element={<ComponentsPreview />} path="/dev/components" />}
              {BrowsePreview && <Route element={<BrowsePreview />} path="/dev/browse" />}
              {ListingPreview && <Route element={<ListingPreview />} path="/dev/listing" />}
              {MessagesPreview && <Route element={<MessagesPreview />} path="/dev/messages/*" />}
              {OwnerPreview && <Route element={<OwnerPreview />} path="/dev/owner" />}
              {WizardPreview && <Route element={<WizardPreview />} path="/dev/wizard/:step?" />}
              {AdminPreview && <Route element={<AdminPreview />} path="/dev/admin" />}
              {AdminListingsPreview && <Route element={<AdminListingsPreview />} path="/dev/admin-listings" />}
              {AdminReviewPreview && <Route element={<AdminReviewPreview />} path="/dev/admin-review" />}
              {AdminUsersPreview && <Route element={<AdminUsersPreview />} path="/dev/admin-users" />}
              {AdminReportsPreview && <Route element={<AdminReportsPreview />} path="/dev/admin-reports/*" />}
              <Route element={<NotFoundPage />} path="*" />
            </Routes>
          </Suspense>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
