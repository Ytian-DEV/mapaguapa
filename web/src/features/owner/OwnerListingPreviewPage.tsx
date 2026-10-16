import { useEffect, useState } from "react";
import { Eye, SearchX } from "lucide-react";
import { useParams } from "react-router-dom";
import type { ListingStatus } from "../../lib/domain";
import { vsuDistanceKm } from "../../lib/geo";
import { ButtonLink, EmptyState, Skeleton, StatusBadge } from "../../ui";
import { fetchListingDetail, type ListingDetailBundle } from "../listing/detailApi";
import { ListingDetailView } from "../listing/ListingDetailView";
import { editPath } from "../wizard/steps";

/** How students see a listing, with its review status. Used by owners and admins. */
export default function OwnerListingPreviewPage({ base = "/owner" }: { base?: "/owner" | "/admin" }) {
  const { listingId = "" } = useParams();
  const [bundle, setBundle] = useState<ListingDetailBundle | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    fetchListingDetail(listingId)
      .then((result) => {
        if (!cancelled) setBundle(result);
      })
      .catch(() => {
        if (!cancelled) setBundle(null);
      });
    return () => {
      cancelled = true;
    };
  }, [listingId]);

  useEffect(() => {
    document.title = bundle ? `Preview: ${bundle.listing.name} · mapaguapa` : "Preview · mapaguapa";
  }, [bundle]);

  if (bundle === undefined) return <Skeleton height={480} radius="var(--radius-card)" />;
  if (bundle === null) {
    return (
      <EmptyState
        action={<ButtonLink to={`${base}/listings`}>{base === "/admin" ? "Back to listings" : "Back to my listings"}</ButtonLink>}
        icon={<SearchX />}
        title="Listing not found"
      />
    );
  }

  const status = bundle.listing.status as ListingStatus;
  return (
    <div className="owner-preview">
      <ListingDetailView
        {...bundle}
        back={{ to: `${base}/listings`, label: base === "/admin" ? "Listings" : "My listings" }}
        distanceKm={vsuDistanceKm(bundle.listing.location_lat, bundle.listing.location_lng)}
        notice={
          <div className="owner-banner owner-preview__notice">
            <Eye aria-hidden="true" />
            <p>
              Preview — this is how students see {base === "/admin" ? "this" : "your"} listing. <StatusBadge status={status} />
            </p>
            {status !== "archived" && (
              <ButtonLink size="sm" to={editPath(base, bundle.listing.id)} variant="secondary">
                Edit listing
              </ButtonLink>
            )}
          </div>
        }
        onMessage={null}
      />
    </div>
  );
}
