import { BadgeCheck, Copy, MessageSquare, Phone } from "lucide-react";
import { Avatar, Badge, Button, useToast } from "../../ui";
import type { ListingDetail, OwnerCard } from "./detailApi";
import { includedBadge, priceSummary, telHref } from "./listingFacts";

type ContactCardProps = {
  listing: ListingDetail;
  owner: OwnerCard | null;
  onMessage: (() => void) | null;
  messaging?: boolean;
};

/** Sticky contact card from frame 03. */
export function ContactCard({ listing, owner, onMessage, messaging = false }: ContactCardProps) {
  const toast = useToast();
  const price = priceSummary(listing);
  const included = includedBadge(listing);
  const number = listing.contact_number?.trim() || null;
  const tel = number ? telHref(number) : null;
  const contactName = owner?.full_name?.trim() || listing.contact_person?.trim() || "Owner";
  const verified = Boolean(owner?.is_verified_owner);

  const copyNumber = async () => {
    if (!number) return;
    try {
      await navigator.clipboard.writeText(number);
      toast.success("Number copied.");
    } catch {
      toast.error("Couldn’t copy. Long-press the number to copy it.");
    }
  };

  return (
    <section aria-label="Contact the owner" className="contact-card">
      <p className="contact-card__price">
        <strong>{price.amount}</strong>
        {price.suffix && <span>{price.suffix}</span>}
      </p>
      {included && (
        <Badge className="contact-card__included" tone="green">
          {included}
        </Badge>
      )}

      <hr />

      <div className="contact-card__owner">
        <Avatar name={contactName} size="lg" src={owner?.avatar_url} tone="clay" />
        <div>
          <p className="contact-card__name">{contactName}</p>
          <p className="contact-card__role">{owner ? "Owner" : "Contact person"}</p>
          {verified && (
            <Badge icon={<BadgeCheck />} tone="green">
              Verified owner
            </Badge>
          )}
        </div>
      </div>

      {number && (
        <div className="contact-card__number">
          <p className="v2-eyebrow contact-card__label">Mobile</p>
          <p className="contact-card__digits">{number}</p>
        </div>
      )}

      {onMessage && (
        <Button block leadingIcon={<MessageSquare />} loading={messaging} onClick={onMessage} size="lg">
          Message owner
        </Button>
      )}
      {number && (
        <div className="contact-card__actions">
          {tel && (
            <a className="ui-btn ui-btn--secondary ui-btn--md" href={tel}>
              <Phone aria-hidden="true" />
              <span className="ui-btn__label">Call</span>
            </a>
          )}
          <Button leadingIcon={<Copy />} onClick={() => void copyNumber()} variant="secondary">
            Copy number
          </Button>
        </div>
      )}
      {!onMessage && !number && listing.other_contact_information?.trim() && (
        <p className="contact-card__other">{listing.other_contact_information}</p>
      )}

      <p className="contact-card__note">Visit the place before paying any deposit, and never send money to someone you haven’t met.</p>
    </section>
  );
}
