import { useEffect } from "react";
import { MapPinOff } from "lucide-react";
import { ButtonLink, Card, EmptyState } from "../ui";

/** 404 inside the owner and admin shells, so the sidebar stays put. */
export default function NotFoundPanel({ home }: { home: string }) {
  useEffect(() => {
    document.title = "Page not found · mapaguapa";
  }, []);

  return (
    <Card padding="none">
      <EmptyState
        action={<ButtonLink to={home}>Back to overview</ButtonLink>}
        description="This page doesn’t exist or has moved. Use the menu to find what you need."
        icon={<MapPinOff />}
        title="We couldn’t find that page"
      />
    </Card>
  );
}
