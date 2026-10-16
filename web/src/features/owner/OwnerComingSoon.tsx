import { useEffect } from "react";
import { Construction } from "lucide-react";
import { useAuth } from "../../app/AuthProvider";
import { Card, EmptyState, PageHeader } from "../../ui";

/** Placeholder for owner pages that ship later (the listing wizard arrives in feature 9). */
export default function OwnerComingSoon() {
  const { profile } = useAuth();
  const firstName = profile?.full_name?.trim().split(/\s+/)[0];

  useEffect(() => {
    document.title = "Owner portal · mapaguapa";
  }, []);

  return (
    <>
      <PageHeader
        eyebrow="Owner portal"
        subtitle="This part of the owner portal is on its way."
        title={firstName ? `Welcome, ${firstName}` : "Welcome"}
      />
      <Card padding="none">
        <EmptyState
          description="The listing editor is being built. Your overview, inquiries and verification already work."
          icon={<Construction />}
          title="Coming soon"
        />
      </Card>
    </>
  );
}
