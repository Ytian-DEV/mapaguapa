import { AlertTriangle, ArrowUpRight, ImageOff, MapPin } from "lucide-react";
import { PRICE_BAND_LABELS, type PriceBand } from "../../lib/domain";
import { publicPhotoUrl } from "../../lib/photos";
import { ButtonLink } from "../../ui";
import { EXCLUSIVITY_LABELS, type ExclusivityGroup } from "../browse/browseApi";
import type { ListingSummary } from "./messagingApi";

/** Right column of frame 04: "About this place". */
export function ListingPanel({ listing, listingId }: { listing: ListingSummary | undefined; listingId: string | null }) {
  if (!listing || !listingId) {
    return (
      <div className="side-panel">
        <p className="v2-eyebrow">About this place</p>
        <p className="v2-muted" style={{ fontSize: "var(--text-sm)" }}>
          This listing is no longer available.
        </p>
      </div>
    );
  }

  const photo = publicPhotoUrl(listing.cover_bucket, listing.cover_path);
  const rooms =
    listing.rooms_total && listing.rooms_available !== null
      ? `${listing.rooms_total} · ${listing.rooms_available} left`
      : listing.rooms_total ?? listing.rooms_available ?? null;
  const rows: Array<[string, string]> = [];
  rows.push(["Rent", listing.price_band ? PRICE_BAND_LABELS[listing.price_band as PriceBand] : listing.monthly_rental_label || "Ask"]);
  if (rooms !== null) rows.push(["Rooms", String(rooms)]);
  if (listing.exclusivity_group) rows.push(["Who can stay", EXCLUSIVITY_LABELS[listing.exclusivity_group as ExclusivityGroup]]);
  if (listing.curfew?.trim()) rows.push(["Curfew", listing.has_curfew ? listing.curfew : "None"]);

  return (
    <div className="side-panel">
      <p className="v2-eyebrow">About this place</p>
      <div className="side-panel__photo">
        {photo ? <img alt="" decoding="async" loading="lazy" src={photo} /> : <ImageOff aria-hidden="true" className="side-panel__no-photo" />}
      </div>
      <div>
        <h2 className="side-panel__title">{listing.name}</h2>
        <p className="side-panel__meta">
          <MapPin aria-hidden="true" />
          {[listing.area, listing.accommodation_type].filter(Boolean).join(" · ")}
        </p>
      </div>
      <dl className="side-panel__rows">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <ButtonLink block leadingIcon={<ArrowUpRight />} to={`/listing/${listingId}`} variant="secondary">
        View listing
      </ButtonLink>
      <p className="side-panel__warning">
        <AlertTriangle aria-hidden="true" />
        Never send a deposit before you visit. Report anyone who asks for payment upfront.
      </p>
    </div>
  );
}
