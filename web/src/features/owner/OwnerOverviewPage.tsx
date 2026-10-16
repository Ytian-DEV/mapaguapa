import { useEffect, useState } from "react";
import { useAuth } from "../../app/AuthProvider";
import { useInbox } from "../messaging/InboxContext";
import { fetchUpcomingVisits, type UpcomingVisit } from "./ownerApi";
import { useOwnerData } from "./OwnerDataContext";
import { OwnerOverviewView } from "./OwnerOverviewView";

export default function OwnerOverviewPage() {
  const { profile } = useAuth();
  const { listings, overview, status, refresh } = useOwnerData();
  const { conversations } = useInbox();
  const [visits, setVisits] = useState<UpcomingVisit[]>([]);

  useEffect(() => {
    document.title = "Overview · Owner portal · mapaguapa";
    void refresh();
    fetchUpcomingVisits()
      .then(setVisits)
      .catch(() => setVisits([]));
  }, [refresh]);

  return (
    <OwnerOverviewView
      conversations={conversations}
      firstName={profile?.full_name?.trim().split(/\s+/)[0] ?? null}
      listings={listings}
      overview={overview}
      ownerId={profile?.id ?? ""}
      status={status}
      visits={visits}
    />
  );
}
