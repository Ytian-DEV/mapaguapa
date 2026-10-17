import { useState } from "react";
import { Heart, Home, Map } from "lucide-react";
import { TopNav, useToast } from "../ui";
import { ListingDetailView } from "../features/listing/ListingDetailView";
import { vsuDistanceKm } from "../lib/geo";
import { fixtureListing, fixturePhotos } from "./listingFixture";
import "../features/browse/student-shell.css";

const listing = fixtureListing;
const photos = fixturePhotos;

export default function ListingPreview() {
  const toast = useToast();
  const [saved, setSaved] = useState(false);
  return (
    <div className="v2 student-shell">
      <TopNav
        links={[
          { to: "/dev/browse", label: "Browse", icon: <Home /> },
          { to: "/map", label: "Map view", icon: <Map /> },
          { to: "/saved", label: "Saved", icon: <Heart /> },
        ]}
        savedCount={saved ? 1 : 0}
        user={{ name: "Dev Student" }}
      />
      <ListingDetailView
        distanceKm={vsuDistanceKm(listing.location_lat, listing.location_lng)}
        listing={listing}
        onMessage={() => toast.show("Would open a conversation")}
        onToggleSaved={() => setSaved((value) => !value)}
        owner={{ id: "fixture-owner", full_name: "Fixture Owner", avatar_url: null, role: "owner", is_verified_owner: true }}
        photos={photos}
        saved={saved}
      />
    </div>
  );
}
