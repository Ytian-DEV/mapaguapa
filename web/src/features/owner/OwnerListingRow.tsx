import { Eye, ImageOff, Pencil } from "lucide-react";
import { PRICE_BAND_LABELS, type ListingStatus, type PriceBand } from "../../lib/domain";
import { publicPhotoUrl } from "../../lib/photos";
import { ButtonLink, StatusBadge } from "../../ui";
import { EXCLUSIVITY_LABELS, type ExclusivityGroup } from "../browse/browseApi";
import { listTime } from "../messaging/time";
import { WIZARD_STEPS, editPath, stepKeyAt } from "../wizard/steps";
import type { OwnerListing } from "./ownerApi";

type OwnerListingRowProps = {
  listing: OwnerListing;
  stats?: { views_30d: number; inquiries: number };
};

function infoLine(listing: OwnerListing, stats?: OwnerListingRowProps["stats"]) {
  switch (listing.status) {
    case "published":
      return stats ? `${stats.views_30d} views (30 days) · ${stats.inquiries} ${stats.inquiries === 1 ? "inquiry" : "inquiries"}` : "Live for students";
    case "in_review":
      return "Admin is checking photos, details and map pin";
    case "changes_requested":
      return listing.review_note ? `Admin: ${listing.review_note}` : "Admin asked for changes";
    case "draft": {
      const step = listing.draft_step ?? 1;
      return `Step ${step} of ${WIZARD_STEPS.length} · ${WIZARD_STEPS[step - 1]?.label ?? "Basics"} · last saved ${listTime(listing.updated_at).toLowerCase()}`;
    }
    case "archived":
      return "Archived by an admin. Contact support to restore it.";
    default:
      return "";
  }
}

/** One listing in "My listings" (frame O1) with the action that fits its status. */
export function OwnerListingRow({ listing, stats }: OwnerListingRowProps) {
  const photo = publicPhotoUrl(listing.cover_bucket, listing.cover_path);
  const status = (listing.status ?? "draft") as ListingStatus;
  const meta = [
    listing.area,
    listing.exclusivity_group ? EXCLUSIVITY_LABELS[listing.exclusivity_group as ExclusivityGroup].replace(" only", "") : null,
    listing.price_band ? PRICE_BAND_LABELS[listing.price_band as PriceBand] : null,
  ]
    .filter(Boolean)
    .join(" · ");

  let action = null;
  if (status === "draft") {
    action = (
      <ButtonLink size="sm" to={editPath("/owner", listing.id, stepKeyAt(listing.draft_step))}>
        Continue
      </ButtonLink>
    );
  } else if (status === "changes_requested") {
    action = (
      <ButtonLink leadingIcon={<Pencil />} size="sm" to={editPath("/owner", listing.id)}>
        Fix &amp; resubmit
      </ButtonLink>
    );
  } else if (status === "published") {
    action = (
      <ButtonLink leadingIcon={<Pencil />} size="sm" to={editPath("/owner", listing.id)} variant="secondary">
        Edit
      </ButtonLink>
    );
  } else if (status === "in_review") {
    action = (
      <ButtonLink leadingIcon={<Eye />} size="sm" to={`/owner/listings/${listing.id}/preview`} variant="secondary">
        View
      </ButtonLink>
    );
  }

  return (
    <li className="owner-listing">
      <span className="owner-listing__thumb">{photo ? <img alt="" loading="lazy" src={photo} /> : <ImageOff aria-hidden="true" />}</span>
      <div className="owner-listing__body">
        <p className="owner-listing__title">
          <span className="owner-listing__name">{listing.name?.trim() || "Untitled draft"}</span>
          <StatusBadge status={status} />
        </p>
        {meta && <p className="owner-listing__meta">{meta}</p>}
        <p className={`owner-listing__info${status === "changes_requested" ? " owner-listing__info--note" : ""}`}>{infoLine(listing, stats)}</p>
      </div>
      {action && <div className="owner-listing__action">{action}</div>}
    </li>
  );
}
