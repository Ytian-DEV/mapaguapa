import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "../../app/AuthProvider";
import { fetchOwnerListings, fetchOwnerOverview, type OwnerListing, type OwnerOverview } from "./ownerApi";

type OwnerDataValue = {
  listings: OwnerListing[];
  overview: OwnerOverview | null;
  status: "loading" | "ready" | "error";
  refresh: () => Promise<void>;
};

const OwnerDataContext = createContext<OwnerDataValue | null>(null);

/** The signed-in owner's listings and overview stats (sidebar counts, Overview, My listings). */
export function OwnerDataProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const [listings, setListings] = useState<OwnerListing[]>([]);
  const [overview, setOverview] = useState<OwnerOverview | null>(null);
  const [status, setStatus] = useState<OwnerDataValue["status"]>("loading");

  const refresh = useCallback(async () => {
    if (!profile) return;
    try {
      const [rows, stats] = await Promise.all([fetchOwnerListings(profile.id), fetchOwnerOverview().catch(() => null)]);
      setListings(rows);
      setOverview(stats);
      setStatus("ready");
    } catch {
      setStatus((current) => (current === "ready" ? current : "error"));
    }
  }, [profile]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(() => ({ listings, overview, status, refresh }), [listings, overview, status, refresh]);
  return <OwnerDataContext.Provider value={value}>{children}</OwnerDataContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useOwnerData() {
  const context = useContext(OwnerDataContext);
  if (!context) throw new Error("useOwnerData must be used inside <OwnerDataProvider>.");
  return context;
}
