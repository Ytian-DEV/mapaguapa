import { Construction } from "lucide-react";
import { ButtonLink, Card, EmptyState, PageHeader } from "../../ui";

/** Admin pages that land in later features; the v1 console stays available until then. */
export default function AdminComingSoon({ title }: { title: string }) {
  return (
    <>
      <PageHeader eyebrow="Admin console" title={title} />
      <Card padding="none">
        <EmptyState
          action={
            <ButtonLink to="/admin/legacy" variant="secondary">
              Open the previous admin console
            </ButtonLink>
          }
          description="This page is being rebuilt. Until then, the previous console still manages users."
          icon={<Construction />}
          title={`${title} is coming soon`}
        />
      </Card>
    </>
  );
}
