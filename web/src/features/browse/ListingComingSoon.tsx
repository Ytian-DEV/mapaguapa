import { ArrowLeft, Construction } from "lucide-react";
import { ButtonLink, EmptyState } from "../../ui";

/** Stand-in for /listing/:id until the listing detail page ships (feature 6). */
export default function ListingComingSoon() {
  return (
    <div className="v2-container" style={{ paddingBlock: "48px" }}>
      <EmptyState
        action={
          <ButtonLink leadingIcon={<ArrowLeft />} to="/" variant="secondary">
            Back to browse
          </ButtonLink>
        }
        description="Photos, rules, bills and the owner’s contact will be on this page."
        icon={<Construction />}
        title="Listing details are coming soon"
      />
    </div>
  );
}
