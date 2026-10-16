import { useMemo, useState } from "react";
import { ImageOff, MessageSquare, Search } from "lucide-react";
import { NavLink } from "react-router-dom";
import { publicPhotoUrl } from "../../lib/photos";
import { Avatar, Chip, ChipGroup, EmptyState, Input, Skeleton, cx } from "../../ui";
import type { InboxRow, ListingSummary } from "./messagingApi";
import { listTime } from "./time";

type Filter = "all" | "unread" | "visits";

type ConversationListProps = {
  side: "student" | "owner";
  conversations: InboxRow[];
  listings: Map<string, ListingSummary>;
  status: "loading" | "ready" | "error";
  basePath: string;
  title?: string;
};

/** Left column of frames 04 and O3: search, All / Unread / Visits, conversation rows. */
export function ConversationList({ side, conversations, listings, status, basePath, title }: ConversationListProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const unread = conversations.filter((row) => (row.unread_count ?? 0) > 0).length;
  const visits = conversations.filter((row) => row.has_open_visit).length;

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return conversations.filter((row) => {
      if (filter === "unread" && !(row.unread_count ?? 0)) return false;
      if (filter === "visits" && !row.has_open_visit) return false;
      if (!needle) return true;
      return [row.other_name, row.listing_name, row.last_message_preview].some((value) => value?.toLowerCase().includes(needle));
    });
  }, [conversations, filter, query]);

  return (
    <section aria-label="Conversations" className="convo-list">
      {title && <h1 className="convo-list__title">{title}</h1>}
      <Input
        aria-label="Search conversations"
        leadingIcon={<Search />}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={side === "owner" ? "Search by name or listing" : "Search conversations"}
        type="search"
        value={query}
      />
      <ChipGroup className="convo-list__filters" label="Filter conversations">
        <Chip onClick={() => setFilter("all")} selected={filter === "all"}>
          All
        </Chip>
        <Chip onClick={() => setFilter("unread")} selected={filter === "unread"}>
          Unread{unread ? ` · ${unread}` : ""}
        </Chip>
        <Chip onClick={() => setFilter("visits")} selected={filter === "visits"}>
          Visits{visits ? ` · ${visits}` : ""}
        </Chip>
      </ChipGroup>

      <div className="convo-list__rows">
        {status === "loading" &&
          Array.from({ length: 4 }, (_, index) => (
            <div className="convo-row convo-row--skeleton" key={index} aria-hidden="true">
              <Skeleton height={48} radius="var(--radius-control)" width={48} />
              <div style={{ display: "grid", gap: 6, flex: 1 }}>
                <Skeleton height={14} width="60%" />
                <Skeleton height={12} width="90%" />
              </div>
            </div>
          ))}

        {status !== "loading" && visible.length === 0 && (
          <EmptyState
            compact
            description={
              conversations.length === 0
                ? side === "owner"
                  ? "When students message you about a listing, they’ll show up here."
                  : "Message an owner from any listing to ask about rooms or visits."
                : "Nothing matches that filter."
            }
            icon={<MessageSquare />}
            title={conversations.length === 0 ? (side === "owner" ? "No inquiries yet" : "No messages yet") : "No matches"}
          />
        )}

        {visible.map((row) => {
          const listing = row.listing_id ? listings.get(row.listing_id) : undefined;
          const unreadCount = row.unread_count ?? 0;
          const photo = listing ? publicPhotoUrl(listing.cover_bucket, listing.cover_path) : "";
          const name = side === "student" ? row.listing_name || "Listing" : row.other_name || "Student";
          const sub = side === "student" ? row.other_name || "Owner" : row.listing_name || "";
          return (
            <NavLink
              className={({ isActive }) => cx("convo-row", isActive && "convo-row--active", unreadCount > 0 && "convo-row--unread")}
              key={row.id}
              to={`${basePath}/${row.id}`}
            >
              {side === "student" ? (
                <span className="convo-row__thumb">{photo ? <img alt="" loading="lazy" src={photo} /> : <ImageOff aria-hidden="true" />}</span>
              ) : (
                <Avatar name={row.other_name} src={row.other_avatar_url} />
              )}
              <span className="convo-row__body">
                <span className="convo-row__top">
                  <span className="convo-row__name">{name}</span>
                  <span className="convo-row__time">{listTime(row.last_message_at ?? row.created_at)}</span>
                </span>
                {sub && <span className={cx("convo-row__sub", side === "owner" && "convo-row__sub--listing")}>{sub}</span>}
                <span className="convo-row__preview">
                  {row.is_blocked ? "Blocked" : row.last_message_preview || "No messages yet"}
                  {unreadCount > 0 && (
                    <span className="convo-row__dot">
                      <span className="v2-sr-only">{unreadCount} unread</span>
                    </span>
                  )}
                </span>
              </span>
            </NavLink>
          );
        })}
      </div>
    </section>
  );
}
