import { Construction } from "lucide-react";
import { Card, EmptyState, PageHeader } from "../../ui";

/** Admin pages that land in later features. */
export default function AdminComingSoon({ title }: { title: string }) {
  return (
    <>
      <PageHeader eyebrow="Admin console" title={title} />
      <Card padding="none">
        <EmptyState
          description="This page is being rebuilt."
          icon={<Construction />}
          title={`${title} is coming soon`}
        />
      </Card>
    </>
  );
}
