import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, List, Plus } from "lucide-react";
import type { ListingStatus } from "../../lib/domain";
import { Button, ButtonLink, Card, EmptyState, PageHeader, Skeleton, Tabs } from "../../ui";
import { useOwnerData } from "./OwnerDataContext";
import { OwnerListingRow } from "./OwnerListingRow";
import "./owner.css";

type Tab = "all" | ListingStatus;

const TAB_LABELS: Record<Tab, string> = {
  all: "All",
  published: "Published",
  in_review: "In review",
  changes_requested: "Changes requested",
  draft: "Drafts",
  archived: "Archived",
};

export default function OwnerListingsPage() {
  const { listings, overview, status, refresh } = useOwnerData();
  const [tab, setTab] = useState<Tab>("all");

  useEffect(() => {
    document.title = "My listings · Owner portal · mapaguapa";
    void refresh();
  }, [refresh]);

  const counts = useMemo(() => {
    const result: Record<Tab, number> = { all: 0, published: 0, in_review: 0, changes_requested: 0, draft: 0, archived: 0 };
    listings.forEach((listing) => {
      const key = (listing.status ?? "draft") as ListingStatus;
      result[key] += 1;
      if (key !== "archived") result.all += 1;
    });
    return result;
  }, [listings]);

  const visible = listings.filter((listing) => (tab === "all" ? listing.status !== "archived" : listing.status === tab));
  const statsById = new Map((overview?.listings ?? []).map((item) => [item.id, item]));
  const tabs = (Object.keys(TAB_LABELS) as Tab[]).filter((key) => key === "all" || counts[key] > 0 || key === tab);

  return (
    <>
      <PageHeader
        actions={
          <ButtonLink leadingIcon={<Plus />} to="/owner/listings/new">
            Create listing
          </ButtonLink>
        }
        eyebrow="Owner portal"
        subtitle="Drafts save automatically. Edits to a live listing go back to review before students see them."
        title="My listings"
      />
      <Tabs
        className="owner-tabs"
        idPrefix="owner-listings"
        items={tabs.map((key) => ({ value: key, label: TAB_LABELS[key], count: counts[key] }))}
        label="Listing status"
        onChange={setTab}
        value={tab}
      />
      <Card className="owner-card" padding="none">
        {status === "loading" && (
          <div style={{ padding: 20, display: "grid", gap: 12 }}>
            <Skeleton height={60} />
            <Skeleton height={60} />
            <Skeleton height={60} />
          </div>
        )}
        {status === "error" && (
          <EmptyState
            action={
              <Button onClick={() => void refresh()} variant="secondary">
                Try again
              </Button>
            }
            icon={<AlertTriangle />}
            title="Couldn’t load your listings"
            tone="error"
          />
        )}
        {status === "ready" && visible.length === 0 && (
          <EmptyState
            action={
              tab === "all" ? (
                <ButtonLink leadingIcon={<Plus />} to="/owner/listings/new">
                  Create your first listing
                </ButtonLink>
              ) : undefined
            }
            description={tab === "all" ? "Add your boarding house so VSU students can find it." : "Nothing here right now."}
            icon={<List />}
            title={tab === "all" ? "No listings yet" : `No ${TAB_LABELS[tab].toLowerCase()} listings`}
          />
        )}
        {status === "ready" && visible.length > 0 && (
          <ul className="owner-list" id="owner-listings-panel" role="tabpanel">
            {visible.map((listing) => (
              <OwnerListingRow key={listing.id} listing={listing} stats={statsById.get(listing.id)} />
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
