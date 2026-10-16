import { AlertTriangle, ArrowUpRight, CalendarDays, MessageSquare, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { Avatar, Badge, ButtonLink, Card, EmptyState, PageHeader, Skeleton, StatCard } from "../../ui";
import type { InboxRow } from "../messaging/messagingApi";
import { listTime } from "../messaging/time";
import { editPath } from "../wizard/steps";
import type { OwnerListing, OwnerOverview, UpcomingVisit } from "./ownerApi";
import { OwnerListingRow } from "./OwnerListingRow";
import "./owner.css";

export type OwnerOverviewViewProps = {
  firstName: string | null;
  ownerId: string;
  listings: OwnerListing[];
  overview: OwnerOverview | null;
  conversations: InboxRow[];
  visits: UpcomingVisit[];
  status: "loading" | "ready" | "error";
  now?: Date;
};

function greeting(date: Date) {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function formatReplyTime(minutes: number | null | undefined) {
  if (minutes === null || minutes === undefined) return "—";
  if (minutes < 60) return `${Math.max(1, Math.round(minutes))}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ${Math.round(minutes % 60)}m`;
  return `${Math.round(hours / 24)}d`;
}

function trend(current: number, previous: number) {
  if (previous === 0) return current > 0 ? "New" : null;
  const change = Math.round(((current - previous) / previous) * 100);
  return `${change >= 0 ? "+" : ""}${change}%`;
}

const dayFmt = new Intl.DateTimeFormat("en-PH", { weekday: "short" });
const dateFmt = new Intl.DateTimeFormat("en-PH", { day: "numeric" });
const timeFmt = new Intl.DateTimeFormat("en-PH", { hour: "numeric", minute: "2-digit" });

/** Owner Overview (frame O1). Presentational; data comes from the page. */
export function OwnerOverviewView({ firstName, ownerId, listings, overview, conversations, visits, status, now = new Date() }: OwnerOverviewViewProps) {
  const active = listings.filter((listing) => listing.status !== "archived");
  const published = active.filter((listing) => listing.status === "published");
  const statsById = new Map((overview?.listings ?? []).map((item) => [item.id, item]));
  const lowStock = published.find((listing) => listing.rooms_available !== null && (listing.rooms_available ?? 0) <= 1);
  const roomsTotal = published.reduce((sum, listing) => sum + (listing.rooms_total ?? 0), 0);
  const roomsAvailable = published.reduce((sum, listing) => sum + (listing.rooms_available ?? 0), 0);
  const viewsTrend = overview ? trend(overview.views_30d, overview.views_prev_30d) : null;
  const byConversation = new Map(conversations.map((row) => [row.id, row]));
  const latestPublished = published[0];

  return (
    <div className="owner-overview">
      <PageHeader
        actions={
          <>
            {latestPublished && (
              <ButtonLink leadingIcon={<ArrowUpRight />} to={`/owner/listings/${latestPublished.id}/preview`} variant="secondary">
                View public page
              </ButtonLink>
            )}
            <ButtonLink leadingIcon={<Plus />} to="/owner/listings/new">
              Create listing
            </ButtonLink>
          </>
        }
        eyebrow="Owner portal"
        subtitle="Here’s how your places are doing this week."
        title={`${greeting(now)}${firstName ? `, ${firstName}` : ""}`}
      />

      {lowStock && (
        <div className="owner-banner" role="status">
          <AlertTriangle aria-hidden="true" />
          <p>
            {lowStock.rooms_available === 0 ? (
              <>
                <strong>{lowStock.name}</strong> is marked full. Students can still find it — update rooms when one opens up.
              </>
            ) : (
              <>
                <strong>{lowStock.name}</strong> has 1 room left. Keep availability updated so students don’t message you about full rooms.
              </>
            )}
          </p>
          <ButtonLink size="sm" to={editPath("/owner", lowStock.id, "rooms")} variant="secondary">
            Update rooms
          </ButtonLink>
        </div>
      )}

      <div className="owner-stats">
        {status === "loading" ? (
          Array.from({ length: 4 }, (_, index) => <Skeleton height={132} key={index} radius="var(--radius-card-lg)" />)
        ) : (
          <>
            <StatCard
              label={<span className="v2-eyebrow owner-stats__label">Listing views · 30 days</span>}
              meta="From searches and shared links"
              value={
                <span className="owner-stats__value">
                  {overview?.views_30d ?? 0}
                  {viewsTrend && <Badge tone={viewsTrend.startsWith("-") ? "gray" : "green"}>{viewsTrend}</Badge>}
                </span>
              }
            />
            <StatCard
              label={<span className="v2-eyebrow owner-stats__label">New inquiries</span>}
              meta={`Across your ${active.length} ${active.length === 1 ? "listing" : "listings"}`}
              value={
                <span className="owner-stats__value">
                  {overview?.new_inquiries ?? 0}
                  {(overview?.unread ?? 0) > 0 && <Badge tone="clay">{overview?.unread} unread</Badge>}
                </span>
              }
            />
            <StatCard
              label={<span className="v2-eyebrow owner-stats__label">Avg. reply time</span>}
              meta="First reply, last 90 days"
              value={formatReplyTime(overview?.avg_reply_minutes)}
            />
            <StatCard
              label={<span className="v2-eyebrow owner-stats__label">Rooms available</span>}
              meta={published.length === 1 ? published[0].name : `Across ${published.length} published ${published.length === 1 ? "listing" : "listings"}`}
              value={roomsTotal > 0 ? `${roomsAvailable} / ${roomsTotal}` : "—"}
            />
          </>
        )}
      </div>

      <div className="owner-grid">
        <Card className="owner-card" padding="none">
          <header className="owner-card__head">
            <h2>My listings</h2>
            {active.length > 3 && <Link to="/owner/listings">See all</Link>}
          </header>
          {status === "loading" ? (
            <div style={{ padding: 20, display: "grid", gap: 12 }}>
              <Skeleton height={60} />
              <Skeleton height={60} />
            </div>
          ) : active.length === 0 ? (
            <EmptyState
              action={
                <ButtonLink leadingIcon={<Plus />} to="/owner/listings/new">
                  Create your first listing
                </ButtonLink>
              }
              compact
              description="It takes about 10 minutes. You can save a draft and finish later."
              title="List your place"
            />
          ) : (
            <ul className="owner-list">
              {active.slice(0, 3).map((listing) => (
                <OwnerListingRow key={listing.id} listing={listing} stats={statsById.get(listing.id)} />
              ))}
            </ul>
          )}
        </Card>

        <div className="owner-side">
          <Card className="owner-card" padding="none">
            <header className="owner-card__head">
              <h2>Recent inquiries</h2>
              <Link to="/owner/inquiries">Open inbox</Link>
            </header>
            {conversations.length === 0 ? (
              <EmptyState compact description="Students who message you will show up here." icon={<MessageSquare />} title="No inquiries yet" />
            ) : (
              <ul className="owner-inquiries">
                {conversations.slice(0, 3).map((row) => (
                  <li key={row.id}>
                    <Link className="owner-inquiry" to={`/owner/inquiries/${row.id}`}>
                      <Avatar name={row.other_name} src={row.other_avatar_url} />
                      <span className="owner-inquiry__body">
                        <span className="owner-inquiry__top">
                          <strong>{row.other_name || "Student"}</strong>
                          <span>
                            {listTime(row.last_message_at)}
                            {(row.unread_count ?? 0) > 0 && <span aria-label="unread" className="owner-inquiry__dot" />}
                          </span>
                        </span>
                        <span className="owner-inquiry__listing">{row.listing_name}</span>
                        <span className="owner-inquiry__preview">{row.last_message_preview}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="owner-card" padding="none">
            <header className="owner-card__head">
              <h2>Upcoming visits</h2>
            </header>
            {visits.length === 0 ? (
              <EmptyState compact description="Visit requests from students appear here." icon={<CalendarDays />} title="No visits scheduled" />
            ) : (
              <ul className="owner-visits">
                {visits.map((visit) => {
                  const convo = byConversation.get(visit.conversation_id);
                  const date = new Date(visit.proposed_at);
                  const needsReply = visit.status === "pending" && visit.proposed_by !== ownerId;
                  return (
                    <li key={visit.id}>
                      <Link className="owner-visit" to={`/owner/inquiries/${visit.conversation_id}`}>
                        <span className="owner-visit__date">
                          <span>{dayFmt.format(date)}</span>
                          <strong>{dateFmt.format(date)}</strong>
                        </span>
                        <span className="owner-visit__body">
                          <strong>{convo?.other_name || "Student"}</strong>
                          <span>
                            {timeFmt.format(date)}
                            {convo?.interest_room ? ` · ${convo.interest_room}` : ""}
                          </span>
                        </span>
                        {visit.status === "confirmed" ? (
                          <Badge dot tone="green">
                            Confirmed
                          </Badge>
                        ) : needsReply ? (
                          <Badge dot tone="amber">
                            Needs reply
                          </Badge>
                        ) : (
                          <Badge dot tone="gray">
                            Waiting
                          </Badge>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
