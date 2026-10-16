import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "../../app/AuthProvider";
import { useToast } from "../../ui";
import { fetchSavedIds, saveListing, unsaveListing } from "./browseApi";

type SavedContextValue = {
  savedIds: Set<string>;
  isSaved: (listingId: string) => boolean;
  toggleSaved: (listingId: string, listingName?: string) => Promise<void>;
};

const SavedContext = createContext<SavedContextValue | null>(null);

/** Saved (heart) state shared by the nav count, cards and the Saved page. */
export function SavedProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const toast = useToast();
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!profile) {
      setSavedIds(new Set());
      return;
    }
    let cancelled = false;
    fetchSavedIds(profile.id)
      .then((ids) => {
        if (!cancelled) setSavedIds(ids);
      })
      .catch(() => {
        if (!cancelled) setSavedIds(new Set());
      });
    return () => {
      cancelled = true;
    };
  }, [profile]);

  const toggleSaved = useCallback(
    async (listingId: string, listingName?: string) => {
      if (!profile) return;
      const wasSaved = savedIds.has(listingId);
      // Optimistic update; roll back on failure.
      setSavedIds((current) => {
        const next = new Set(current);
        if (wasSaved) next.delete(listingId);
        else next.add(listingId);
        return next;
      });
      try {
        if (wasSaved) await unsaveListing(profile.id, listingId);
        else await saveListing(profile.id, listingId);
        toast.show(wasSaved ? `Removed${listingName ? ` ${listingName}` : ""} from saved.` : `Saved${listingName ? ` ${listingName}` : ""}.`, "success");
      } catch {
        setSavedIds((current) => {
          const next = new Set(current);
          if (wasSaved) next.add(listingId);
          else next.delete(listingId);
          return next;
        });
        toast.error("Couldn’t update your saved places. Try again.");
      }
    },
    [profile, savedIds, toast]
  );

  const value = useMemo<SavedContextValue>(
    () => ({ savedIds, isSaved: (id) => savedIds.has(id), toggleSaved }),
    [savedIds, toggleSaved]
  );

  return <SavedContext.Provider value={value}>{children}</SavedContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSaved() {
  const context = useContext(SavedContext);
  if (!context) throw new Error("useSaved must be used inside <SavedProvider>.");
  return context;
}
