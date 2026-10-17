import type { ReactNode } from "react";
import { Heart, Home, Map, MessageSquare } from "lucide-react";
import { useInbox } from "../messaging/InboxContext";
import { useAuth } from "../../app/AuthProvider";
import { Logo, TopNav, type TopNavLink } from "../../ui";
import { useSaved } from "./SavedContext";
import "./student-shell.css";


/** Student frame from frame 02: top nav, page content, footer. */
export function StudentShell({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth();
  const { savedIds } = useSaved();
  const { unreadTotal } = useInbox();
  const studentLinks: TopNavLink[] = [
    { to: "/", label: "Browse", icon: <Home />, end: true },
    { to: "/map", label: "Map view", icon: <Map /> },
    { to: "/saved", label: "Saved", icon: <Heart /> },
    { to: "/messages", label: "Messages", icon: <MessageSquare />, badge: unreadTotal },
  ];

  return (
    <div className="v2 student-shell">
      <a className="v2-skip" href="#main">
        Skip to content
      </a>
      <TopNav
        links={studentLinks}
        onSignOut={() => void signOut()}
        savedCount={savedIds.size}
        user={profile ? { name: profile.full_name || profile.email || "Student", avatarUrl: profile.avatar_url } : null}
      />
      <main className="student-shell__main" id="main">
        {children}
      </main>
      <footer className="student-shell__footer">
        <div className="v2-container student-shell__footer-inner">
          <Logo />
          <p>Made for VSU students by Lily Tech Solutions Co.</p>
          <p>© {new Date().getFullYear()}</p>
        </div>
      </footer>
    </div>
  );
}
