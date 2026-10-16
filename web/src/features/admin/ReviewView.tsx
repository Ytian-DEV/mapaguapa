import { useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, ArrowUpRight, BadgeCheck, Check, ChevronLeft, ChevronRight, Pencil } from "lucide-react";
import { Link } from "react-router-dom";
import { PRICE_BAND_LABELS, type PriceBand } from "../../lib/domain";
import { formatPeso } from "../../lib/format";
import { isValidLatLng } from "../../lib/geo";
import { publicPhotoUrl } from "../../lib/photos";
import { Badge, Button, Card, Chip, ConfirmDialog, Dialog, Textarea } from "../../ui";
import type { ListingDetailBundle } from "../listing/detailApi";
import { exclusivityLabel, hasCurfew, occupancyLabel } from "../listing/listingFacts";
import { listTime } from "../messaging/time";
import type { SimilarListing } from "./reviewApi";
import "./review.css";

export const CHECKLIST = [
  "Photos are clear and show the actual place",
  "Price range matches the rent",
  "Map pin is on the right building",
  "Contact number is reachable",
  "Not a duplicate of an existing listing",
];

export const NOTE_TEMPLATES: Array<{ label: string; text: string }> = [
  { label: "Blurry photos", text: "Some photos are blurry or dark. Please upload clear photos of a room, the comfort room and the outside." },
  { label: "Wrong pin", text: "The map pin doesn’t match the address. Please move it onto the building’s entrance." },
  { label: "Missing contact", text: "Please add a mobile number students can call or text." },
  { label: "Price unclear", text: "The rent doesn’t match the room types. Please check the monthly rent per person." },
  { label: "Duplicate", text: "This looks like a listing that already exists. Please edit the existing one instead." },
];

export type ReviewViewProps = {
  bundle: ListingDetailBundle;
  position: { index: number; total: number };
  prev: { id: string; name: string } | null;
  next: { id: string; name: string } | null;
  similar: SimilarListing[];
  onApprove: () => Promise<void>;
  onRequestChanges: (note: string) => Promise<void>;
};

function Detail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="review-detail">
      <dt>{label}</dt>
      <dd>{value || "—"}</dd>
    </div>
  );
}

/** Review submission (frame A3). */
export function ReviewView({ bundle, position, prev, next, similar, onApprove, onRequestChanges }: ReviewViewProps) {
  const { listing, photos, owner } = bundle;
  const [checked, setChecked] = useState<boolean[]>(CHECKLIST.map(() => false));
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"approve" | "changes" | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [confirmApprove, setConfirmApprove] = useState(false);

  // Fresh checklist and note for every submission.
  useEffect(() => {
    setChecked(CHECKLIST.map(() => false));
    setNote("");
    setNoteError(null);
  }, [listing.id]);

  const done = checked.filter(Boolean).length;
  const isEdit = Boolean(listing.published_at);
  const submittedBy = owner?.full_name || listing.contact_person || "an admin";
  const band = listing.price_band ? PRICE_BAND_LABELS[listing.price_band as PriceBand] : null;
  const curfew = hasCurfew(listing.curfew);
  const relevantSimilar = similar.filter((item) => item.id && item.status !== "archived");

  const approve = async () => {
    setConfirmApprove(false);
    setBusy("approve");
    try {
      await onApprove();
    } finally {
      setBusy(null);
    }
  };

  const sendChanges = async () => {
    if (note.trim().length < 10) {
      setNoteError("Tell the owner what to fix (at least a short sentence).");
      return;
    }
    setBusy("changes");
    try {
      await onRequestChanges(note);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="review">
      <div className="review__top">
        <p className="v2-eyebrow">
          Review queue · {position.index + 1} of {position.total}
        </p>
        <nav aria-label="Queue navigation" className="review__nav">
          {prev && (
            <Link to={`/admin/review/${prev.id}`}>
              <ChevronLeft aria-hidden="true" /> Previous
            </Link>
          )}
          {next && (
            <Link to={`/admin/review/${next.id}`}>
              Next: {next.name} <ChevronRight aria-hidden="true" />
            </Link>
          )}
        </nav>
      </div>

      <header className="review__header">
        <div>
          <h1 className="v2-h1">{listing.name}</h1>
          <p className="review__sub">
            Submitted by {submittedBy}
            {owner?.is_verified_owner && (
              <Badge icon={<BadgeCheck />} tone="green">
                Verified owner
              </Badge>
            )}
            <span>
              · {listTime(listing.submitted_at ?? listing.updated_at)} · {isEdit ? "Edit of a live listing" : "New listing"}
            </span>
          </p>
        </div>
        <div className="review__actions">
          <Button leadingIcon={<Pencil />} loading={busy === "changes"} onClick={() => void sendChanges()} variant="secondary">
            Request changes
          </Button>
          <Button leadingIcon={<Check />} loading={busy === "approve"} onClick={() => (done < CHECKLIST.length ? setConfirmApprove(true) : void approve())}>
            Approve &amp; publish
          </Button>
        </div>
      </header>

      <div className="review__layout">
        <div className="review__main">
          <Card className="admin-card" padding="none">
            <header className="admin-card__head">
              <h2>Photos · {photos.length}</h2>
              {photos.length > 0 && (
                <button className="review__link" onClick={() => setGalleryOpen(true)} type="button">
                  Open gallery
                </button>
              )}
            </header>
            {photos.length === 0 ? (
              <p className="review__empty">No photos uploaded.</p>
            ) : (
              <ul className="review-strip">
                {photos.slice(0, 5).map((photo, index) => (
                  <li key={photo.id}>
                    <button aria-label={`Open photo ${index + 1}`} onClick={() => setGalleryOpen(true)} type="button">
                      <img alt="" loading="lazy" src={publicPhotoUrl(photo.storage_bucket, photo.storage_path)} />
                      {index === 0 && <span className="review-strip__cover">Cover</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="admin-card" padding="none">
            <header className="admin-card__head">
              <h2>Submitted details</h2>
            </header>
            <dl className="review-details">
              <Detail label="Type" value={listing.accommodation_type === "Others" ? listing.accommodation_type_other : listing.accommodation_type} />
              <Detail label="Who can stay" value={exclusivityLabel(listing)?.label} />
              <Detail
                label="Rent"
                value={
                  listing.rent_exact !== null ? (
                    <>
                      {formatPeso(Number(listing.rent_exact))} / person {band && <span className="review-detail__arrow">→ {band}</span>}
                    </>
                  ) : (
                    listing.monthly_rental_label
                  )
                }
              />
              <Detail label="Advance & deposit" value={listing.advance_deposit} />
              <Detail label="Rooms" value={listing.rooms_total ? `${listing.rooms_total} total · ${listing.rooms_available ?? 0} available` : null} />
              <Detail label="Floors" value={listing.floor_count ? String(listing.floor_count) : listing.floors_label} />
              <Detail label="People per room" value={occupancyLabel(listing)} />
              <Detail label="Bills included" value={listing.bills_included} />
              <Detail label="Not included" value={listing.bills_not_included} />
              <Detail label="Curfew" value={curfew === null ? null : curfew ? `Yes · ${listing.curfew}` : "No"} />
              <Detail label="Contact" value={[listing.contact_person, listing.contact_number].filter(Boolean).join(" · ")} />
              <Detail label="Location" value={`${listing.address}${isValidLatLng(listing.location_lat, listing.location_lng) ? " · pin set" : " · no pin"}`} />
            </dl>
            {listing.description && <p className="review__description">{listing.description}</p>}
          </Card>
        </div>

        <aside className="review__side">
          {relevantSimilar.length > 0 && (
            <div className="review-similar" role="status">
              <AlertTriangle aria-hidden="true" />
              <div>
                <p className="review-similar__title">{relevantSimilar.length === 1 ? "Similar listing found" : `${relevantSimilar.length} similar listings found`}</p>
                <ul>
                  {relevantSimilar.slice(0, 3).map((item) => (
                    <li key={item.id}>
                      <Link to={`/admin/listings/${item.id}/preview`}>{item.name}</Link> —{" "}
                      {item.reason === "same_owner_and_area" ? "same owner, same barangay" : "similar name"}
                    </li>
                  ))}
                </ul>
                <p>Confirm it’s a separate building before approving.</p>
              </div>
            </div>
          )}

          <Card className="admin-card" padding="none">
            <header className="admin-card__head">
              <h2>Review checklist</h2>
              <span className="review__count">
                {done} of {CHECKLIST.length}
              </span>
            </header>
            <ul className="review-checklist">
              {CHECKLIST.map((item, index) => (
                <li key={item}>
                  <label>
                    <input
                      checked={checked[index]}
                      onChange={(event) => setChecked((current) => current.map((value, i) => (i === index ? event.target.checked : value)))}
                      type="checkbox"
                    />
                    {item}
                  </label>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="admin-card" padding="none">
            <header className="admin-card__head">
              <h2>Note to owner</h2>
            </header>
            <div className="review-note">
              <Textarea
                aria-describedby={noteError ? "review-note-error" : undefined}
                aria-invalid={noteError ? true : undefined}
                aria-label="Note to owner"
                maxLength={1000}
                onChange={(event) => {
                  setNote(event.target.value);
                  setNoteError(null);
                }}
                placeholder="Only needed if you request changes. The owner sees this note."
                rows={4}
                value={note}
              />
              {noteError && (
                <p className="ui-field__error" id="review-note-error" role="alert">
                  {noteError}
                </p>
              )}
              <div className="review-note__chips">
                {NOTE_TEMPLATES.map((template) => (
                  <Chip key={template.label} onClick={() => setNote((current) => (current.trim() ? `${current.trim()}\n${template.text}` : template.text))}>
                    {template.label}
                  </Chip>
                ))}
              </div>
            </div>
          </Card>

          <Link className="review__preview" to={`/admin/listings/${listing.id}/preview`}>
            <ArrowUpRight aria-hidden="true" /> Preview as students will see it
          </Link>
        </aside>
      </div>

      <Dialog onClose={() => setGalleryOpen(false)} open={galleryOpen} size="lg" title={`${listing.name} · ${photos.length} photos`}>
        <div className="review-gallery">
          {photos.map((photo) => (
            <img alt={photo.alt_text ?? ""} key={photo.id} loading="lazy" src={publicPhotoUrl(photo.storage_bucket, photo.storage_path)} />
          ))}
        </div>
      </Dialog>
      <ConfirmDialog
        confirmLabel="Approve anyway"
        description={`${CHECKLIST.length - done} checklist ${CHECKLIST.length - done === 1 ? "item isn’t" : "items aren’t"} ticked. Students will see this listing right away.`}
        onCancel={() => setConfirmApprove(false)}
        onConfirm={() => void approve()}
        open={confirmApprove}
        title="Approve without the full checklist?"
      />
    </div>
  );
}
