import { useCallback, useMemo, useState } from "react";
import { Heart, Home } from "lucide-react";
import { TopNav } from "../ui";
import { EMPTY_FILTERS, type BrowseFilters, type ListingCardRow } from "../features/browse/browseApi";
import { BrowseView } from "../features/browse/BrowseView";
import "../features/browse/student-shell.css";

// Dev-only fixtures (not bundled in production): exercise every card variant.
const base: Omit<ListingCardRow, "id" | "name"> = {
  area: "Guadalupe",
  address: "Guadalupe, Baybay City",
  accommodation_type: "Boarding house",
  exclusivity_group: "mixed",
  price_band: "3000_plus",
  rent_exact: 3200,
  monthly_rental_label: "₱3,000+",
  rooms_available: 8,
  has_wifi: true,
  has_study_area: false,
  has_laundry_area: false,
  has_parking_area: false,
  has_common_kitchen: false,
  has_aircon: false,
  has_curfew: true,
  curfew: "10 PM",
  distance_km: 0.6,
  location_lat: null,
  location_lng: null,
  cover_bucket: null,
  cover_path: null,
};

const fixtures: ListingCardRow[] = [
  { ...base, id: "f1", name: "Fixture Mixed House" },
  { ...base, id: "f2", name: "Fixture Study Lodge", area: "Marcos", rooms_available: null, has_study_area: true, has_parking_area: true, has_curfew: null, curfew: null },
  { ...base, id: "f3", name: "Fixture Ladies Dorm with a Very Long Name That Truncates", area: "Pangasugan", exclusivity_group: "ladies", price_band: "1000_1999", has_laundry_area: true },
  { ...base, id: "f4", name: "Fixture Men's Place", area: "Pangasugan", exclusivity_group: "men", has_common_kitchen: true, has_curfew: false, curfew: "None" },
  { ...base, id: "f5", name: "Fixture Budget Room", area: "Gabas", accommodation_type: "Apartment", price_band: "under_1000", exclusivity_group: null, rooms_available: 1 },
  { ...base, id: "f6", name: "Fixture Label Only", price_band: null, monthly_rental_label: "Ask owner", has_wifi: false },
];

const AMENITY_FIELD = { wifi: "has_wifi", study: "has_study_area", laundry: "has_laundry_area", parking: "has_parking_area", kitchen: "has_common_kitchen", aircon: "has_aircon" } as const;

export default function BrowsePreview() {
  const [filters, setFilters] = useState<BrowseFilters>(EMPTY_FILTERS);
  const [saved, setSaved] = useState<Set<string>>(new Set(["f1"]));
  const [status, setStatus] = useState<"loading" | "ready" | "error">("ready");

  const rows = useMemo(
    () =>
      fixtures.filter(
        (row) =>
          (!filters.q || row.name?.toLowerCase().includes(filters.q.toLowerCase()) || row.area?.toLowerCase().includes(filters.q.toLowerCase())) &&
          (!filters.area || row.area === filters.area) &&
          (!filters.band || row.price_band === filters.band) &&
          (!filters.type || row.accommodation_type === filters.type) &&
          (!filters.who || row.exclusivity_group === filters.who) &&
          (!filters.noCurfew || (row.curfew && row.has_curfew === false)) &&
          filters.amenities.every((amenity) => row[AMENITY_FIELD[amenity]])
      ),
    [filters]
  );

  const onChange = useCallback((patch: Partial<BrowseFilters>) => setFilters((current) => ({ ...current, ...patch })), []);

  return (
    <div className="v2 student-shell">
      <TopNav
        links={[
          { to: "/dev/browse", label: "Browse", icon: <Home />, end: true },
          { to: "/saved", label: "Saved", icon: <Heart /> },
        ]}
        savedCount={saved.size}
        user={{ name: "Dev Student" }}
      />
      <div className="v2-container" style={{ display: "flex", gap: 8, paddingTop: 12 }}>
        {(["ready", "loading", "error"] as const).map((value) => (
          <button key={value} onClick={() => setStatus(value)} type="button">
            {value}
          </button>
        ))}
      </div>
      <BrowseView
        filters={filters}
        isSaved={(id) => saved.has(id)}
        loadingMore={false}
        onChange={onChange}
        onMore={() => undefined}
        onReset={() => setFilters((current) => ({ ...EMPTY_FILTERS, sort: current.sort }))}
        onRetry={() => setStatus("ready")}
        onToggleSaved={(listing) =>
          setSaved((current) => {
            const next = new Set(current);
            if (next.has(listing.id)) next.delete(listing.id);
            else next.add(listing.id);
            return next;
          })
        }
        options={{ areas: ["Gabas", "Guadalupe", "Marcos", "Pangasugan"], types: ["Apartment", "Boarding house"] }}
        rows={rows}
        status={status}
        total={rows.length + (filters.q ? 0 : 84)}
      />
    </div>
  );
}
