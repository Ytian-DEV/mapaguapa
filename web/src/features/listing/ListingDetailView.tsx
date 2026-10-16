import { useState, type ReactNode } from "react";
import { ArrowLeft, ArrowUpRight, Check, Heart, MapPin, MessageSquare, Phone, Share2, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { formatDistance, isValidLatLng } from "../../lib/geo";
import { Button, cx, useToast } from "../../ui";
import { LocationMap } from "../map/LocationMap";
import { ReportDialog } from "../reports/ReportDialog";
import { ContactCard } from "./ContactCard";
import type { ListingDetailBundle } from "./detailApi";
import {
  amenities,
  billRows,
  directionsUrl,
  exclusivityLabel,
  factTiles,
  metaLine,
  priceSummary,
  ruleRows,
  safetyFeatures,
  telHref,
  type Row,
} from "./listingFacts";
import { PhotoGallery } from "./PhotoGallery";
import "./listing-detail.css";

type ListingDetailViewProps = ListingDetailBundle & {
  saved?: boolean;
  /** Omit to hide Save (e.g. owner preview). */
  onToggleSaved?: () => void;
  /** Where "Back" goes; the student breadcrumb is shown only for the default. */
  back?: { to: string; label: string };
  /** Shown above the title, e.g. the owner-preview notice. */
  notice?: ReactNode;
  /** null hides "Message owner" (admin-managed listings or non-students). */
  onMessage: (() => void) | null;
  messaging?: boolean;
  distanceKm?: number | null;
};

function Section({ eyebrow, title, children, className }: { eyebrow: string; title: string; children: ReactNode; className?: string }) {
  return (
    <section className={cx("detail-section", className)}>
      <p className="v2-eyebrow">{eyebrow}</p>
      <h2 className="detail-section__title">{title}</h2>
      {children}
    </section>
  );
}

function Rows({ rows }: { rows: Row[] }) {
  return (
    <dl className="detail-rows">
      {rows.map((row) => (
        <div className="detail-rows__row" key={row.label}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ListingDetailView({ listing, photos, owner, saved = false, onToggleSaved, onMessage, messaging, distanceKm, back, notice }: ListingDetailViewProps) {
  const toast = useToast();
  const [reportOpen, setReportOpen] = useState(false);
  const exclusivity = exclusivityLabel(listing);
  const facts = factTiles(listing);
  const included = amenities(listing);
  const bills = billRows(listing);
  const rules = ruleRows(listing);
  const safety = safetyFeatures(listing);
  const meta = metaLine(listing);
  const price = priceSummary(listing);
  const hasLocation = isValidLatLng(listing.location_lat, listing.location_lng);
  const area = listing.address.split(",")[0]?.trim();
  const distance = formatDistance(distanceKm);
  const tel = listing.contact_number ? telHref(listing.contact_number) : null;

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: listing.name, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success("Link copied.");
    } catch {
      // Share sheet dismissed.
    }
  };

  return (
    <article className="detail v2-container">
      <nav aria-label="Breadcrumb" className="detail__crumbs">
        <Link className="detail__back" to={back?.to ?? "/"}>
          <ArrowLeft aria-hidden="true" /> {back?.label ?? "Back to results"}
        </Link>
        {!back && (
        <ol>
          <li>
            <Link to="/">Browse</Link>
          </li>
          {area && (
            <li>
              <Link to={`/?q=${encodeURIComponent(area)}`}>{area}</Link>
            </li>
          )}
          <li aria-current="page">{listing.name}</li>
        </ol>
        )}
      </nav>
      {notice}

      <header className="detail__header">
        <div className="detail__heading">
          <p className="v2-eyebrow">{[listing.accommodation_type, exclusivity?.label].filter(Boolean).join(" · ")}</p>
          <h1 className="detail__title">{listing.name}</h1>
          <p className="detail__meta">
            <span className="detail__address">
              <MapPin aria-hidden="true" />
              {listing.address}
            </span>
            {distance && <span>{distance}</span>}
            {meta.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </p>
        </div>
        <div className="detail__header-actions">
          <Button leadingIcon={<Share2 />} onClick={() => void share()} size="sm" variant="secondary">
            Share
          </Button>
          {onToggleSaved && (
            <Button
              aria-pressed={saved}
              className={cx(saved && "detail__saved")}
              leadingIcon={<Heart />}
              onClick={onToggleSaved}
              size="sm"
              variant="secondary"
            >
              {saved ? "Saved" : "Save"}
            </Button>
          )}
        </div>
      </header>

      <PhotoGallery listingName={listing.name} photos={photos} />

      <div className="detail__layout">
        <div className="detail__main">
          {facts.length > 0 && (
            <dl className="detail-facts">
              {facts.map((fact) => (
                <div className="detail-facts__tile" key={fact.label}>
                  <dt className="v2-eyebrow">{fact.label}</dt>
                  <dd>
                    <span className="detail-facts__value">{fact.value}</span>
                    {fact.hint && <span className="detail-facts__hint">{fact.hint}</span>}
                  </dd>
                </div>
              ))}
            </dl>
          )}

          <Section eyebrow="Overview" title="About this place">
            <p className="detail__about">
              {listing.description?.trim() ||
                `${listing.accommodation_type} in ${listing.address}. Contact the owner for photos of the rooms and current availability.`}
            </p>
          </Section>

          <Section eyebrow="Essentials" title="What’s included">
            {included.length > 0 ? (
              <ul className="detail-amenities">
                {included.map((item) => (
                  <li key={item}>
                    <span aria-hidden="true" className="detail-amenities__check">
                      <Check />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="detail__empty">The owner hasn’t listed amenities yet — ask when you message them.</p>
            )}
          </Section>

          {bills.length > 0 && (
            <Section eyebrow="Money" title="Bills & fees">
              <Rows rows={bills} />
            </Section>
          )}

          {(rules.length > 0 || safety.length > 0) && (
            <div className="detail__pair">
              {rules.length > 0 && (
                <Section eyebrow="House rules" title="Living here">
                  <Rows rows={rules} />
                </Section>
              )}
              {safety.length > 0 && (
                <Section eyebrow="Safety" title="Safety features">
                  <ul className="detail-safety">
                    {safety.map((item) => (
                      <li key={item}>
                        <ShieldCheck aria-hidden="true" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </Section>
              )}
            </div>
          )}

          <Section className="detail-location" eyebrow="Location" title="Where it is">
            {hasLocation ? (
              <>
                <div className="detail-location__map">
                  <LocationMap label={`Map showing ${listing.name}`} lat={listing.location_lat as number} lng={listing.location_lng as number} />
                </div>
                <div className="detail-location__foot">
                  <div>
                    <p className="detail-location__address">{listing.address}</p>
                    <p className="detail-location__hint">{listing.owner_id ? "Pin placed by the owner" : "Pin placed by the mapaguapa team"}</p>
                  </div>
                  <a
                    className="ui-btn ui-btn--secondary ui-btn--md"
                    href={directionsUrl(listing.location_lat as number, listing.location_lng as number)}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <ArrowUpRight aria-hidden="true" />
                    <span className="ui-btn__label">Get directions</span>
                  </a>
                </div>
              </>
            ) : (
              <p className="detail__empty">
                {listing.address}. The exact pin hasn’t been added yet — ask the owner for directions.
              </p>
            )}
          </Section>
        </div>

        <aside className="detail__aside">
          <div className="detail__sticky">
            <ContactCard listing={listing} messaging={messaging} onMessage={onMessage} owner={owner} />
            <div className="detail__report">
              <span>Something wrong with this listing?</span>
              <button onClick={() => setReportOpen(true)} type="button">
                Report
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* Phones: price and the main action stay reachable. */}
      <div className="detail-bar">
        <p className="detail-bar__price">
          <strong>{price.amount}</strong>
          {price.suffix && <span>{price.suffix}</span>}
        </p>
        {onMessage ? (
          <Button leadingIcon={<MessageSquare />} loading={messaging} onClick={onMessage}>
            Message
          </Button>
        ) : (
          tel && (
            <a className="ui-btn ui-btn--primary ui-btn--md" href={tel}>
              <Phone aria-hidden="true" />
              <span className="ui-btn__label">Call</span>
            </a>
          )
        )}
      </div>

      <ReportDialog onClose={() => setReportOpen(false)} open={reportOpen} target={{ type: "listing", listingId: listing.id, name: listing.name }} />
    </article>
  );
}
