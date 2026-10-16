import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { fetchAdminOverview, type AdminOverview } from "./adminApi";

type AdminDataValue = {
  overview: AdminOverview | null;
  status: "loading" | "ready" | "error";
  refresh: () => Promise<void>;
};

const AdminDataContext = createContext<AdminDataValue | null>(null);

/** admin_overview() for the sidebar counts and the Overview page; refresh after admin actions. */
export function AdminDataProvider({ children }: { children: ReactNode }) {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [status, setStatus] = useState<AdminDataValue["status"]>("loading");

  const refresh = useCallback(async () => {
    try {
      setOverview(await fetchAdminOverview());
      setStatus("ready");
    } catch {
      setStatus((current) => (current === "ready" ? current : "error"));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(() => ({ overview, status, refresh }), [overview, status, refresh]);
  return <AdminDataContext.Provider value={value}>{children}</AdminDataContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAdminData() {
  const context = useContext(AdminDataContext);
  if (!context) throw new Error("useAdminData must be used inside <AdminDataProvider>.");
  return context;
}
