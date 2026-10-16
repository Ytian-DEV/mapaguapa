import { useEffect, useState } from "react";
import { AlertTriangle, Heart } from "lucide-react";
import { useAuth } from "../../app/AuthProvider";
import { Button, ButtonLink, EmptyState, ListingCardSkeleton, LoadingRegion } from "../../ui";
import { fetchSavedListings, type ListingCardRow } from "./browseApi";
import { ListingCard } from "./ListingCard";
import { useSaved } from "./SavedContext";
import "./browse.css";

export default function SavedPage() {
  const { profile } = useAuth();
  const { isSaved, toggleSaved, savedIds } = useSaved();
  const [rows, setRows] = useState<ListingCardRow[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    document.title = "Saved places · mapaguapa";
  }, []);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    setStatus("loading");
    fetchSavedListings(profile.id)
      .then((saved) => {
        if (cancelled) return;
        setRows(saved);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [profile, reloadToken]);

  // Un-hearting removes the card right away; re-hearting elsewhere shows on next visit.
  const visible = rows.filter((row) => savedIds.has(row.id));

  return (
    <div className="browse v2-container">
      <header className="browse__header">
        <div className="browse__title-row">
          <div className="browse__title">
            <p className="v2-eyebrow">Your shortlist</p>
            <h1 className="browse__h1">Saved places</h1>
          </div>
          {status === "ready" && (
            <p aria-live="polite" className="browse__count">
              {visible.length} saved
            </p>
          )}
        </div>
      </header>

      {status === "loading" && (
        <LoadingRegion label="Loading saved places">
          <div className="browse__grid">
            {Array.from({ length: 3 }, (_, index) => (
              <ListingCardSkeleton key={index} />
            ))}
          </div>
        </LoadingRegion>
      )}

      {status === "error" && (
        <EmptyState
          action={
            <Button onClick={() => setReloadToken((value) => value + 1)} variant="secondary">
              Try again
            </Button>
          }
          description="Check your connection and try again."
          icon={<AlertTriangle />}
          title="Couldn’t load your saved places"
          tone="error"
        />
      )}

      {status === "ready" && visible.length === 0 && (
        <EmptyState
          action={<ButtonLink to="/">Browse places</ButtonLink>}
          description="Tap the heart on any place to keep it here while you compare."
          icon={<Heart />}
          title="Nothing saved yet"
        />
      )}

      {status === "ready" && visible.length > 0 && (
        <div className="browse__grid">
          {visible.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              onToggleSaved={() => void toggleSaved(listing.id, listing.name ?? undefined)}
              saved={isSaved(listing.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
