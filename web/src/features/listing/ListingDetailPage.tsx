import { useEffect, useState } from "react";
import { AlertTriangle, SearchX } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../app/AuthProvider";
import { vsuDistanceKm } from "../../lib/geo";
import { Button, ButtonLink, EmptyState, LoadingRegion, Skeleton, useToast } from "../../ui";
import { useSaved } from "../browse/SavedContext";
import { fetchListingDetail, recordListingView, startConversation, type ListingDetailBundle } from "./detailApi";
import { ListingDetailView } from "./ListingDetailView";
import { reportError } from "../../lib/errors";

function DetailSkeleton() {
  return (
    <LoadingRegion label="Loading listing">
      <div className="detail v2-container" aria-hidden="true">
        <Skeleton height={14} width={220} />
        <div style={{ display: "grid", gap: 12, margin: "28px 0" }}>
          <Skeleton height={12} width={160} />
          <Skeleton height={48} width="50%" />
          <Skeleton height={14} width="40%" />
        </div>
        <Skeleton height={420} radius="var(--radius-card)" />
      </div>
    </LoadingRegion>
  );
}

export default function ListingDetailPage() {
  const { listingId = "" } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { profile } = useAuth();
  const { isSaved, toggleSaved } = useSaved();
  const [bundle, setBundle] = useState<ListingDetailBundle | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [reloadToken, setReloadToken] = useState(0);
  const [messaging, setMessaging] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    fetchListingDetail(listingId)
      .then((result) => {
        if (cancelled) return;
        setBundle(result);
        setStatus(result ? "ready" : "missing");
        if (result?.listing.status === "published") recordListingView(result.listing.id);
      })
      .catch((error) => {
        reportError(error);
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [listingId, reloadToken]);

  useEffect(() => {
    document.title = bundle ? `${bundle.listing.name} · mapaguapa` : "Listing · mapaguapa";
  }, [bundle]);

  if (status === "loading") return <DetailSkeleton />;

  if (status === "missing" || !bundle) {
    return (
      <div className="v2-container" style={{ paddingBlock: 48 }}>
        {status === "error" ? (
          <EmptyState
            action={
              <Button onClick={() => setReloadToken((value) => value + 1)} variant="secondary">
                Try again
              </Button>
            }
            description="Check your connection and try again."
            icon={<AlertTriangle />}
            title="Couldn’t load this place"
            tone="error"
          />
        ) : (
          <EmptyState
            action={<ButtonLink to="/">Browse places</ButtonLink>}
            description="It may have been taken down or is waiting for review."
            icon={<SearchX />}
            title="This listing isn’t available"
          />
        )}
      </div>
    );
  }

  const { listing } = bundle;
  const canMessage = Boolean(listing.owner_id) && profile?.role === "student" && listing.owner_id !== profile?.id;

  const handleMessage = async () => {
    setMessaging(true);
    try {
      const conversationId = await startConversation(listing.id);
      navigate(`/messages/${conversationId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn’t open a conversation. Try again.");
      setMessaging(false);
    }
  };

  return (
    <ListingDetailView
      {...bundle}
      distanceKm={vsuDistanceKm(listing.location_lat, listing.location_lng)}
      messaging={messaging}
      onMessage={canMessage ? () => void handleMessage() : null}
      onToggleSaved={() => void toggleSaved(listing.id, listing.name)}
      saved={isSaved(listing.id)}
    />
  );
}
