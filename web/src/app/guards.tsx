import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import type { Role } from "../lib/domain";
import { useAuth } from "./AuthProvider";
import { FullPageLoader } from "./FullPageLoader";

/** Where each role lands after sign-in. */
export function homeFor(role: string | null | undefined) {
  if (role === "admin") return "/admin";
  if (role === "owner") return "/owner";
  return "/";
}

/** Signed-in users with one of `roles` only; others go to sign-in or their own home. */
export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <FullPageLoader />;
  }

  if (!profile) {
    const from = location.pathname + location.search;
    return <Navigate replace state={{ from }} to={`/sign-in${from && from !== "/" ? `?next=${encodeURIComponent(from)}` : ""}`} />;
  }

  if (!roles.includes(profile.role as Role)) {
    return <Navigate replace to={homeFor(profile.role)} />;
  }

  return <>{children}</>;
}

/** Sign-in / sign-up screens: already signed-in users go straight to their home. */
export function PublicOnly({ children }: { children: ReactNode }) {
  const { profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <FullPageLoader />;
  }

  if (profile) {
    const next = new URLSearchParams(location.search).get("next");
    const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
    return <Navigate replace to={safeNext ?? homeFor(profile.role)} />;
  }

  return <>{children}</>;
}
