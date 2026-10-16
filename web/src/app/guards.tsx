import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import type { Profile } from "../lib/models";
import { useAuth } from "./AuthProvider";
import { FullPageLoader } from "./FullPageLoader";

type AppRole = Profile["role"];

/** Where each role lands after sign-in. */
export function homeFor(role: AppRole | null | undefined) {
  return role === "admin" ? "/admin" : "/";
}

/** Renders children only for signed-in users with one of `roles`; otherwise redirects. */
export function RequireRole({ roles, children }: { roles: AppRole[]; children: ReactNode }) {
  const { profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <FullPageLoader />;
  }

  if (!profile) {
    return <Navigate replace state={{ from: location.pathname }} to="/" />;
  }

  if (!roles.includes(profile.role)) {
    return <Navigate replace to={homeFor(profile.role)} />;
  }

  return <>{children}</>;
}
