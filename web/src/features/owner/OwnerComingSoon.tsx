import { useEffect } from "react";
import { Construction } from "lucide-react";
import { useAuth } from "../../app/AuthProvider";
import { Card, EmptyState, PageHeader } from "../../ui";
import { OwnerShell } from "./OwnerShell";

/** Placeholder for the owner area until the owner portal ships (feature 8). */
export default function OwnerComingSoon() {
  const { profile } = useAuth();
  const firstName = profile?.full_name?.trim().split(/\s+/)[0];

  useEffect(() => {
    document.title = "Owner portal · mapaguapa";
  }, []);

  return (
    <OwnerShell>
      <PageHeader
        eyebrow="Owner portal"
        subtitle="Your account is ready. Listing tools are on the way."
        title={firstName ? `Welcome, ${firstName}` : "Welcome"}
      />
      <Card padding="none">
        <EmptyState
          description="Soon you’ll create listings, answer inquiries and schedule visits here. We’ll let you know when it’s live."
          icon={<Construction />}
          title="The owner portal is being built"
        />
      </Card>
    </OwnerShell>
  );
}
