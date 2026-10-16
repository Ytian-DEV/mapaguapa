import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Inbox } from "lucide-react";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Button, ButtonLink, EmptyState, PageHeader, Skeleton, Tabs, useToast } from "../../ui";
import { fetchListingDetail, type ListingDetailBundle } from "../listing/detailApi";
import { useAdminData } from "./AdminDataContext";
import {
  approveListing,
  decideVerification,
  fetchPendingVerifications,
  fetchQueue,
  fetchSimilar,
  requestChanges,
  signDocuments,
  type QueueItem,
  type SimilarListing,
  type Verification,
} from "./reviewApi";
import { ReviewView } from "./ReviewView";
import { VerificationsView } from "./VerificationsView";

type Tab = "listings" | "verifications";
type Load = "loading" | "ready" | "error";

function errorText(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

/** /admin/review and /admin/review/:listingId (frame A3) plus the owner verification tab. */
export default function AdminReviewPage() {
  const { listingId } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { overview, refresh: refreshCounts } = useAdminData();
  const tab: Tab = params.get("tab") === "verifications" ? "verifications" : "listings";

  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [queueStatus, setQueueStatus] = useState<Load>("loading");
  const [bundle, setBundle] = useState<ListingDetailBundle | null>(null);
  const [similar, setSimilar] = useState<SimilarListing[]>([]);
  const [detailStatus, setDetailStatus] = useState<Load>("loading");
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [links, setLinks] = useState<Map<string, string>>(new Map());
  const [verifyStatus, setVerifyStatus] = useState<Load>("loading");

  useEffect(() => {
    document.title = "Review queue · Admin · mapaguapa";
  }, []);

  const loadQueue = useCallback(async () => {
    try {
      setQueue(await fetchQueue());
      setQueueStatus("ready");
    } catch {
      setQueueStatus("error");
    }
  }, []);

  const loadVerifications = useCallback(async () => {
    try {
      const items = await fetchPendingVerifications();
      setVerifications(items);
      setLinks(await signDocuments(items.flatMap((item) => item.document_paths)).catch(() => new Map<string, string>()));
      setVerifyStatus("ready");
    } catch {
      setVerifyStatus("error");
    }
  }, []);

  useEffect(() => {
    void loadQueue();
    void loadVerifications();
  }, [loadQueue, loadVerifications]);

  useEffect(() => {
    if (!listingId) return;
    let stale = false;
    setDetailStatus("loading");
    Promise.all([fetchListingDetail(listingId), fetchSimilar(listingId).catch(() => [])]).then(
      ([detail, matches]) => {
        if (stale) return;
        setBundle(detail);
        setSimilar(matches);
        setDetailStatus("ready");
      },
      () => !stale && setDetailStatus("error")
    );
    return () => {
      stale = true;
    };
  }, [listingId]);

  const index = queue.findIndex((item) => item.id === listingId);
  const prev = index > 0 ? queue[index - 1] : null;
  const next = index >= 0 && index < queue.length - 1 ? queue[index + 1] : null;
  const label = (item: QueueItem | null) => (item ? { id: item.id, name: item.name ?? "Untitled listing" } : null);

  // After a decision, move on to the next submission (or the one before when this was last).
  const advance = async () => {
    const following = next ?? prev;
    await Promise.all([loadQueue(), refreshCounts()]);
    navigate(following ? `/admin/review/${following.id}` : "/admin/review", { replace: true });
  };

  const approve = async () => {
    if (!bundle) return;
    try {
      await approveListing(bundle.listing.id);
      toast.success(`${bundle.listing.name} is live.`);
      await advance();
    } catch (error) {
      toast.error(`Couldn’t publish: ${errorText(error)}`);
    }
  };

  const sendChanges = async (note: string) => {
    if (!bundle) return;
    try {
      await requestChanges(bundle.listing.id, note);
      toast.success("Sent back to the owner with your note.");
      await advance();
    } catch (error) {
      toast.error(`Couldn’t send: ${errorText(error)}`);
    }
  };

  const decide = async (item: Verification, decision: "approved" | "rejected", note: string) => {
    try {
      await decideVerification(item.id, decision, note);
      toast.success(decision === "approved" ? `${item.owner_name ?? "Owner"} is now a verified owner.` : "Documents rejected. The owner can send new ones.");
      await Promise.all([loadVerifications(), refreshCounts()]);
    } catch (error) {
      toast.error(`Couldn’t save: ${errorText(error)}`);
    }
  };

  // Listing tab with no id: open the oldest submission.
  if (tab === "listings" && !listingId && queueStatus === "ready" && queue.length > 0) {
    return <Navigate replace to={`/admin/review/${queue[0].id}`} />;
  }

  const listingCount = queueStatus === "ready" ? queue.length : (overview?.listings.in_review ?? undefined);
  const verifyCount = verifyStatus === "ready" ? verifications.length : (overview?.verifications.pending ?? undefined);
  const tabs = (
    <Tabs
      idPrefix="admin-review"
      items={[
        { value: "listings" as Tab, label: "Listings", count: listingCount },
        { value: "verifications" as Tab, label: "Owner verifications", count: verifyCount },
      ]}
      label="Review type"
      onChange={(value) => (value === "verifications" ? setParams({ tab: "verifications" }) : navigate("/admin/review"))}
      value={tab}
    />
  );

  const retry = (
    <Button onClick={() => window.location.reload()} variant="secondary">
      Try again
    </Button>
  );

  let body: ReactNode;
  let reviewing = false;
  if (tab === "verifications") {
    body =
      verifyStatus === "loading" ? (
        <Skeleton height={160} />
      ) : verifyStatus === "error" ? (
        <EmptyState action={retry} title="Couldn’t load verifications" tone="error" />
      ) : (
        <VerificationsView items={verifications} links={links} onDecide={decide} />
      );
  } else if (queueStatus === "error") {
    body = <EmptyState action={retry} title="Couldn’t load the review queue" tone="error" />;
  } else if (!listingId) {
    body =
      queueStatus === "loading" ? (
        <Skeleton height={240} />
      ) : (
        <EmptyState description="New and edited listings from owners show up here." icon={<Inbox />} title="Nothing waiting for review" />
      );
  } else if (detailStatus === "loading" || queueStatus === "loading") {
    body = <Skeleton height={420} />;
  } else if (detailStatus === "error") {
    body = <EmptyState action={retry} title="Couldn’t load this submission" tone="error" />;
  } else if (!bundle || bundle.listing.status !== "in_review") {
    body = (
      <EmptyState
        action={
          <ButtonLink to="/admin/review" variant="secondary">
            Back to the queue
          </ButtonLink>
        }
        description="It was already reviewed, withdrawn, or doesn’t exist."
        title="This listing isn’t waiting for review"
      />
    );
  } else {
    reviewing = true;
    body = (
      <ReviewView
        bundle={bundle}
        next={label(next)}
        onApprove={approve}
        onRequestChanges={sendChanges}
        position={{ index: Math.max(index, 0), total: Math.max(queue.length, 1) }}
        prev={label(prev)}
        similar={similar}
      />
    );
  }

  return (
    <div className="admin-page">
      {!reviewing && <PageHeader eyebrow="Moderation" title="Review queue" />}
      {tabs}
      {body}
    </div>
  );
}
