import type { ReactNode } from "react";
import { BadgeCheck, HelpCircle, Home, List, MessageSquare, Plus, User } from "lucide-react";
import { useAuth } from "../../app/AuthProvider";
import { AppShell, Sidebar, type SidebarGroup } from "../../ui";

const ownerNav: SidebarGroup[] = [
  {
    label: "Manage",
    items: [
      { to: "/owner", label: "Overview", icon: <Home />, end: true },
      { to: "/owner/listings", label: "My listings", icon: <List /> },
      { to: "/owner/inquiries", label: "Inquiries", icon: <MessageSquare /> },
      { to: "/owner/listings/new", label: "Create listing", icon: <Plus /> },
    ],
  },
  {
    label: "Account",
    items: [
      { to: "/owner/verification", label: "Verification", icon: <BadgeCheck /> },
      { to: "/owner/profile", label: "Profile", icon: <User /> },
      { to: "/about", label: "Help", icon: <HelpCircle /> },
    ],
  },
];

/** Owner portal frame (sidebar from Components 14-301). Counts are added in feature 8. */
export function OwnerShell({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth();
  const verified = Boolean(profile?.verified_owner_at);

  return (
    <AppShell
      sidebar={
        <Sidebar
          groups={ownerNav}
          homeTo="/owner"
          onSignOut={() => void signOut()}
          user={{
            name: profile?.full_name || profile?.email || "Owner",
            subtitle: verified ? "Owner · Verified" : "Owner",
            avatarUrl: profile?.avatar_url,
            tone: "clay",
          }}
          workspace="Owner portal"
        />
      }
    >
      {children}
    </AppShell>
  );
}
