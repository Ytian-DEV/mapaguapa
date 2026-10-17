import { AlertTriangle, BadgeCheck, Download, Flag, ImageOff, MapPin, Plus, Users } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { PRICE_BAND_LABELS, PRICE_BANDS, type ListingStatus, type PriceBand } from "../../lib/domain";
import { publicPhotoUrl } from "../../lib/photos";
import { Avatar, Badge, Button, ButtonLink, Card, EmptyState, PageHeader, Skeleton, StatCard, StatusBadge } from "../../ui";
import { listTime } from "../messaging/time";
import { activityHref, activityText } from "./activityText";
import type { ActivityWithActor, AdminListingRow, AdminOverview } from "./adminApi";
import "./admin.css";

export type AdminOverviewViewProps = {
  meId: string | null;
  overview: AdminOverview | null;
  activity: ActivityWithActor[];
  recentListings: AdminListingRow[];
  status: "loading" | "ready" | "error";
  mapKeyMissing: boolean;
  onExport: () => void;
  exporting?: boolean;
  now?: Date;
};

type Attention = { key: string; icon: ReactNode; tone: "clay" | "red" | "amber" | "gray"; title: string; detail: string; action: { label: string; to: string } };

function daysAgo(iso: string | null, now: Date) {
  if (!iso) return null;
  const days = Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

const dateLine = new Intl.DateTimeFormat("en-PH", { weekday: "long", month: "long", day: "numeric" });

/** Admin Overview (frame A1). Every number comes from admin_overview() / activity_log. */
export function AdminOverviewView({ meId, overview, activity, recentListings, status, mapKeyMissing, onExport, exporting, now = new Date() }: AdminOverviewViewProps) {
  const attention: Attention[] = [];
  if (overview) {
    const waiting = overview.listings.in_review;
    if (waiting > 0) {
      attention.push({
        key: "review",
        icon: <Flag />,
        tone: "clay",
        title: `${waiting} ${waiting === 1 ? "submission" : "submissions"} waiting for review`,
        detail: `Oldest submitted ${daysAgo(overview.listings.oldest_in_review_at, now) ?? "recently"}`,
        action: { label: "Review", to: "/admin/review" },
      });
    }
    if (overview.verifications.pending > 0) {
      attention.push({
        key: "verify",
        icon: <BadgeCheck />,
        tone: "clay",
        title: `${overview.verifications.pending} owner ${overview.verifications.pending === 1 ? "verification" : "verifications"} to check`,
        detail: "Proof of ownership uploaded by owners",
        action: { label: "Review", to: "/admin/review?tab=verifications" },
      });
    }
    if (overview.reports.open > 0) {
      attention.push({
        key: "reports",
        icon: <AlertTriangle />,
        tone: "red",
        title: `${overview.reports.open} ${overview.reports.open === 1 ? "report" : "reports"} from students`,
        detail: overview.reports.latest_open_reason ? `Latest: ${overview.reports.latest_open_reason.replace(/_/g, " ")}` : "Open reports",
        action: { label: "Open", to: "/admin/reports" },
      });
    }
    if (overview.users.possible_duplicates > 0) {
      attention.push({
        key: "duplicates",
        icon: <Users />,
        tone: "amber",
        title: `${overview.users.possible_duplicates} possible duplicate ${overview.users.possible_duplicates === 1 ? "account" : "accounts"}`,
        detail: "Same name, different emails",
        action: { label: "Check", to: "/admin/users?duplicates=1" },
      });
    }
    if (overview.listings.published_without_photos > 0) {
      attention.push({
        key: "photos",
        icon: <ImageOff />,
        tone: "amber",
        title: `${overview.listings.published_without_photos} published ${overview.listings.published_without_photos === 1 ? "listing has" : "listings have"} no photos`,
        detail: "Students skip listings without photos",
        action: { label: "View", to: "/admin/listings?photos=none" },
      });
    }
  }
  if (mapKeyMissing) {
    attention.push({
      key: "maps",
      icon: <MapPin />,
      tone: "gray",
      title: "Map tiles need an API key",
      detail: "Set VITE_MAPTILER_KEY in Vercel; maps use OpenStreetMap until then",
      action: { label: "How to fix", to: "/admin/settings" },
    });
  }

  const bands = overview?.price_bands;
  const bandTotal = bands ? PRICE_BANDS.reduce((sum, band) => sum + (bands[band] ?? 0), 0) : 0;
  const bandMax = bands ? Math.max(1, ...PRICE_BANDS.map((band) => bands[band] ?? 0)) : 1;

  return (
    <div className="admin-overview">
      <PageHeader
        actions={
          <>
            <Button leadingIcon={<Download />} loading={exporting} onClick={onExport} variant="secondary">
              Export
            </Button>
            <ButtonLink leadingIcon={<Plus />} to="/admin/listings/new/edit/basics">
              Add listing
            </ButtonLink>
          </>
        }
        eyebrow="Admin console"
        subtitle={`${dateLine.format(now)} · everything students can see, and what needs a decision.`}
        title="Overview"
      />

      <div className="admin-stats">
        {status === "loading" || !overview ? (
          Array.from({ length: 4 }, (_, index) => <Skeleton height={132} key={index} radius="var(--radius-card-lg)" />)
        ) : (
          <>
            <StatCard label={<span className="v2-eyebrow admin-stats__label">Active listings</span>} meta="Visible to students" value={overview.listings.published} />
            <StatCard label={<span className="v2-eyebrow admin-stats__label">Photos</span>} meta="Stored in listing-photos" value={overview.photos} />
            <StatCard label={<span className="v2-eyebrow admin-stats__label">Archived</span>} meta="Kept for recovery" value={overview.listings.archived} />
            <StatCard
              label={<span className="v2-eyebrow admin-stats__label">Users</span>}
              meta={`${overview.users.admins} ${overview.users.admins === 1 ? "admin" : "admins"} · ${overview.users.owners} ${overview.users.owners === 1 ? "owner" : "owners"}`}
              value={overview.users.total}
            />
          </>
        )}
      </div>

      <div className="admin-grid">
        <div className="admin-main">
          <Card className="admin-card" padding="none">
            <header className="admin-card__head">
              <h2>Needs your attention</h2>
            </header>
            {status === "ready" && attention.length === 0 ? (
              <EmptyState compact description="No submissions, reports or duplicates waiting." icon={<BadgeCheck />} title="All clear" />
            ) : (
              <ul className="admin-attention">
                {attention.map((item) => (
                  <li key={item.key}>
                    <span className={`admin-attention__icon admin-attention__icon--${item.tone}`}>{item.icon}</span>
                    <span className="admin-attention__text">
                      <strong>{item.title}</strong>
                      <span>{item.detail}</span>
                    </span>
                    <ButtonLink size="sm" to={item.action.to} variant="secondary">
                      {item.action.label}
                    </ButtonLink>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="admin-card" padding="none">
            <header className="admin-card__head">
              <h2>Recently updated listings</h2>
              <Link to="/admin/listings">View all{overview ? ` ${overview.listings.published}` : ""}</Link>
            </header>
            {recentListings.length === 0 ? (
              <EmptyState compact title="No listings yet" />
            ) : (
              <ul className="admin-recent">
                {recentListings.map((listing) => {
                  const photo = publicPhotoUrl(listing.cover_bucket, listing.cover_path);
                  const needsPhotos = listing.status === "published" && (listing.photo_count ?? 0) === 0;
                  return (
                    <li key={listing.id}>
                      <span className="admin-thumb">{photo ? <img alt="" loading="lazy" src={photo} /> : <ImageOff aria-hidden="true" />}</span>
                      <span className="admin-recent__name">
                        <strong>{listing.name}</strong>
                        <span>{listing.area}</span>
                      </span>
                      <span className="admin-recent__price">{listing.price_band ? PRICE_BAND_LABELS[listing.price_band as PriceBand] : listing.monthly_rental_label}</span>
                      {needsPhotos ? (
                        <Badge dot tone="amber">
                          Needs photos
                        </Badge>
                      ) : (
                        <StatusBadge status={(listing.status ?? "draft") as ListingStatus} />
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        <div className="admin-side">
          <Card className="admin-card" padding="none">
            <header className="admin-card__head">
              <h2>Recent activity</h2>
            </header>
            {activity.length === 0 ? (
              <EmptyState compact description="Listing, user and report changes show up here." title="Nothing yet" />
            ) : (
              <ul className="admin-activity">
                {activity.map((row) => {
                  const href = activityHref(row);
                  const body = (
                    <>
                      <Avatar name={row.actor_name ?? "System"} size="sm" tone={row.actor_id === meId ? "sage" : "paper"} />
                      <span className="admin-activity__text">
                        <span>{activityText(row, meId)}</span>
                        <time dateTime={row.created_at}>{listTime(row.created_at)}</time>
                      </span>
                    </>
                  );
                  return <li key={row.id}>{href ? <Link to={href}>{body}</Link> : <div>{body}</div>}</li>;
                })}
              </ul>
            )}
          </Card>

          <Card className="admin-card" padding="none">
            <header className="admin-card__head">
              <h2>Listings by price range</h2>
            </header>
            <ul className="admin-bands" aria-label={`Published listings by price range, ${bandTotal} total`}>
              {PRICE_BANDS.map((band) => {
                const count = bands?.[band] ?? 0;
                return (
                  <li key={band}>
                    <span className="admin-bands__label">
                      {PRICE_BAND_LABELS[band]}
                      <strong>{count}</strong>
                    </span>
                    <span aria-hidden="true" className="admin-bands__track">
                      <span className="admin-bands__fill" style={{ width: `${(count / bandMax) * 100}%` }} />
                    </span>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
