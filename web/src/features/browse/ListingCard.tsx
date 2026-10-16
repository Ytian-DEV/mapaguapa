import { Heart, ImageOff } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { PRICE_BAND_LABELS, type PriceBand } from "../../lib/domain";
import { publicPhotoUrl } from "../../lib/photos";
import { Tag, cx } from "../../ui";
import { EXCLUSIVITY_LABELS, type ExclusivityGroup, type ListingCardRow } from "./browseApi";
import "./listing-card.css";

/** Up to three short facts for the card (frame 02 chips). */
export function cardTags(listing: ListingCardRow) {
  const tags: string[] = [];
  if (listing.rooms_available && listing.rooms_available > 0) {
    tags.push(`${listing.rooms_available} ${listing.rooms_available === 1 ? "room" : "rooms"}`);
  }
  if (listing.has_wifi) tags.push("Wi‑Fi");
  if (listing.has_common_kitchen) tags.push("Kitchen");
  if (listing.has_study_area) tags.push("Study area");
  if (listing.has_laundry_area) tags.push("Laundry");
  if (listing.has_parking_area) tags.push("Parking");
  if (listing.curfew?.trim()) tags.push(listing.has_curfew ? "Curfew" : "No curfew");
  return tags.slice(0, 3);
}

export function priceLabel(listing: Pick<ListingCardRow, "price_band" | "monthly_rental_label">) {
  if (listing.price_band) return PRICE_BAND_LABELS[listing.price_band as PriceBand];
  return listing.monthly_rental_label || "Ask owner";
}

type ListingCardProps = {
  listing: ListingCardRow;
  saved: boolean;
  onToggleSaved: () => void;
  /** Highlight from the map (feature 5). */
  active?: boolean;
  onHover?: (hovering: boolean) => void;
};

export function ListingCard({ listing, saved, onToggleSaved, active = false, onHover }: ListingCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const photo = publicPhotoUrl(listing.cover_bucket, listing.cover_path);
  const badge = listing.exclusivity_group ? EXCLUSIVITY_LABELS[listing.exclusivity_group as ExclusivityGroup] : null;
  const meta = [listing.area, listing.accommodation_type].filter(Boolean).join(" · ");
  const price = priceLabel(listing);
  const name = listing.name ?? "Listing";

  return (
    <article
      className={cx("listing-card", active && "listing-card--active")}
      onMouseEnter={onHover ? () => onHover(true) : undefined}
      onMouseLeave={onHover ? () => onHover(false) : undefined}
    >
      <div className="listing-card__photo">
        {photo && !imageFailed ? (
          <img alt="" decoding="async" loading="lazy" onError={() => setImageFailed(true)} src={photo} />
        ) : (
          <span aria-hidden="true" className="listing-card__placeholder">
            <ImageOff />
          </span>
        )}
        {badge && <span className="listing-card__badge">{badge}</span>}
        <button
          aria-label={saved ? `Remove ${name} from saved` : `Save ${name}`}
          aria-pressed={saved}
          className={cx("listing-card__save", saved && "listing-card__save--on")}
          onClick={onToggleSaved}
          type="button"
        >
          <Heart aria-hidden="true" />
        </button>
      </div>
      <div className="listing-card__info">
        <div className="listing-card__title-row">
          <h3 className="listing-card__name">
            <Link className="listing-card__link" to={`/listing/${listing.id}`}>
              {name}
            </Link>
          </h3>
          <p className="listing-card__price">
            {price}
            {listing.price_band && <span> /mo</span>}
          </p>
        </div>
        {meta && <p className="listing-card__meta">{meta}</p>}
        {cardTags(listing).length > 0 && (
          <div className="listing-card__tags">
            {cardTags(listing).map((tag) => (
              <Tag key={tag}>{tag}</Tag>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
