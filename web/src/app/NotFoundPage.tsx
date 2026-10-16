import { useEffect } from "react";
import { MapPinOff } from "lucide-react";
import { ButtonLink, EmptyState, Logo } from "../ui";
import { useAuth } from "./AuthProvider";
import { homeFor } from "./guards";

export default function NotFoundPage() {
  const { profile } = useAuth();

  useEffect(() => {
    document.title = "Page not found · mapaguapa";
  }, []);

  return (
    <div className="v2 not-found">
      <header className="v2-container" style={{ paddingBlock: "24px" }}>
        <Logo to={profile ? homeFor(profile.role) : "/sign-in"} />
      </header>
      <main className="v2-container" id="main">
        <EmptyState
          action={<ButtonLink to={profile ? homeFor(profile.role) : "/sign-in"}>{profile ? "Back to home" : "Go to sign in"}</ButtonLink>}
          description="The page you’re looking for doesn’t exist or has moved."
          icon={<MapPinOff />}
          title="We couldn’t find that page"
        />
      </main>
    </div>
  );
}
