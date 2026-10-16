import type { ReactNode } from "react";
import { AlertTriangle, Archive, Flag, Home, List, SlidersHorizontal, Users } from "lucide-react";
import { useAuth } from "../../app/AuthProvider";
import { AppShell, Sidebar, type SidebarGroup } from "../../ui";
import type { AdminOverview } from "./adminApi";

export function adminNav(overview: AdminOverview | null): SidebarGroup[] {
  const reviewCount = (overview?.listings.in_review ?? 0) + (overview?.verifications.pending ?? 0);
  return [
    {
      label: "Workspace",
      items: [
        { to: "/admin", label: "Overview", icon: <Home />, end: true },
        { to: "/admin/review", label: "Review queue", icon: <Flag />, count: reviewCount, emphasis: true },
        { to: "/admin/listings", label: "Listings", icon: <List />, count: overview?.listings.published, end: true },
        { to: "/admin/archive", label: "Archive", icon: <Archive />, count: overview?.listings.archived },
      ],
    },
    {
      label: "People",
      items: [
        { to: "/admin/users", label: "Users", icon: <Users />, count: overview?.users.total },
        { to: "/admin/reports", label: "Reports", icon: <AlertTriangle />, count: overview?.reports.open, emphasis: (overview?.reports.open ?? 0) > 0 },
      ],
    },
    {
      label: "System",
      items: [{ to: "/admin/settings", label: "Settings", icon: <SlidersHorizontal /> }],
    },
  ];
}

/** Admin console frame (Components 14-231). */
export function AdminShell({ overview, children }: { overview: AdminOverview | null; children: ReactNode }) {
  const { profile, signOut } = useAuth();
  return (
    <AppShell
      sidebar={
        <Sidebar
          groups={adminNav(overview)}
          homeTo="/admin"
          onSignOut={() => void signOut()}
          user={{ name: profile?.full_name || profile?.email || "Admin", subtitle: "Administrator", avatarUrl: profile?.avatar_url, tone: "sage" }}
          workspace="Admin console"
        />
      }
    >
      {children}
    </AppShell>
  );
}
