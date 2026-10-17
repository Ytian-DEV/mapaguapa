import { useState } from "react";
import { useToast } from "../ui";
import { AdminShell } from "../features/admin/AdminShell";
import type { ListingDetail } from "../features/listing/detailApi";
import type { Verification } from "../features/admin/reviewApi";
import { ReviewView } from "../features/admin/ReviewView";
import { VerificationsView } from "../features/admin/VerificationsView";
import { Tabs } from "../ui";
import { fixtureListing, fixturePhotos } from "./listingFixture";

// Dev-only fixtures (not bundled in production).
const listing = {
  ...fixtureListing,
  name: "Fixture Annex",
  status: "in_review",
  submitted_at: new Date(Date.now() - 2 * 3_600_000).toISOString(),
} as ListingDetail;

const verification: Verification = {
  id: "v1",
  owner_id: "fixture-owner",
  document_type: "tax_declaration",
  document_paths: ["fixture-owner/1700000000-tax-declaration.pdf", "fixture-owner/1700000001-id.jpg"],
  note: "The house is under my mother’s name; her ID is attached.",
  status: "pending",
  reviewed_by: null,
  reviewed_at: null,
  review_note: null,
  created_at: new Date(Date.now() - 26 * 3_600_000).toISOString(),
  owner_name: "Fixture Owner",
  owner_email: "owner@example.test",
};

export default function AdminReviewPreview() {
  const toast = useToast();
  const [tab, setTab] = useState<"listings" | "verifications">("listings");
  return (
    <AdminShell overview={null}>
      <div className="admin-page">
        <Tabs
          idPrefix="dev-review"
          items={[
            { value: "listings" as const, label: "Listings", count: 3 },
            { value: "verifications" as const, label: "Owner verifications", count: 1 },
          ]}
          label="Review type"
          onChange={setTab}
          value={tab}
        />
        {tab === "listings" ? (
          <ReviewView
            bundle={{ listing, photos: fixturePhotos, owner: { id: "fixture-owner", full_name: "Fixture Owner", avatar_url: null, role: "owner", is_verified_owner: true } }}
            next={{ id: "n1", name: "Fixture Lodge" }}
            onApprove={async () => toast.success("Would publish")}
            onRequestChanges={async (note) => toast.show(`Would send: ${note.slice(0, 40)}`)}
            position={{ index: 0, total: 3 }}
            prev={null}
            similar={[{ id: "s1", name: "Fixture Boarding House", area: "Guadalupe", status: "published", owner_id: "fixture-owner", reason: "same_owner_and_area", score: 0.6 }]}
          />
        ) : (
          <VerificationsView
            items={[verification]}
            links={new Map([[verification.document_paths[0], "#doc"]])}
            onDecide={async (_item, decision) => toast.show(`Would mark ${decision}`)}
          />
        )}
      </div>
    </AdminShell>
  );
}
