import { useEffect, useState } from "react";
import { useAuth } from "../../app/AuthProvider";
import { useToast } from "../../ui";
import { tileConfig } from "../map/tiles";
import { exportAllListings, fetchRecentActivity, fetchRecentlyUpdatedListings, type ActivityWithActor, type AdminListingRow } from "./adminApi";
import { useAdminData } from "./AdminDataContext";
import { AdminOverviewView } from "./AdminOverviewView";

export default function AdminOverviewPage() {
  const { profile } = useAuth();
  const { overview, status, refresh } = useAdminData();
  const toast = useToast();
  const [activity, setActivity] = useState<ActivityWithActor[]>([]);
  const [recent, setRecent] = useState<AdminListingRow[]>([]);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    document.title = "Overview · Admin · mapaguapa";
    void refresh();
    fetchRecentActivity().then(setActivity, () => setActivity([]));
    fetchRecentlyUpdatedListings().then(setRecent, () => setRecent([]));
  }, [refresh]);

  const onExport = async () => {
    setExporting(true);
    try {
      await exportAllListings();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <AdminOverviewView
      activity={activity}
      exporting={exporting}
      mapKeyMissing={tileConfig.provider !== "maptiler"}
      meId={profile?.id ?? null}
      onExport={() => void onExport()}
      overview={overview}
      recentListings={recent}
      status={status}
    />
  );
}
