import { useDeferredValue, useEffect, useMemo, useState } from "react";
import HouseMark from "../shared/HouseMark";
import { PropertyMap, type PropertyCoordinates } from "../shared/PropertyMap";
import { usePointerGlow } from "../shared/usePointerGlow";
import { fetchActiveListings } from "../../lib/listingService";
import {
  fallbackDescription,
  formatSignals,
  getListingCover,
  labelBoolean,
  toPublicPhotoUrl,
  type ListingPhotoRow,
  type ListingWithPhotos,
  type Profile,
} from "../../lib/models";
import "./mapaguapa-user.css";

type MapaguapaUserPageProps = {
  onSignOut: () => Promise<void>;
  profile: Profile;
};

type ListingSection = {
  title: string;
  subtitle: string;
  items: ListingWithPhotos[];
};

type ModalDetailItem = {
  label: string;
  value: string;
};

type ModalDetailSection = {
  id: string;
  eyebrow: string;
  title: string;
  tone: "overview" | "amenities" | "rules" | "utilities" | "comfort" | "contact";
  items: ModalDetailItem[];
};

const hiddenDetailValues = new Set([
  "",
  "not listed",
  "not specified",
  "no included bills listed",
  "no excluded bills listed",
  "no other amenities listed",
  "no contact person listed",
  "no contact number listed",
  "no extra contact information",
]);

type FeatureFilterKey = "wifi" | "study" | "laundry" | "parking" | "pets" | "visitors";

type FeatureFilterOption = {
  key: FeatureFilterKey;
  label: string;
  matches: (listing: ListingWithPhotos) => boolean;
};

const featureFilterOptions: FeatureFilterOption[] = [
  { key: "wifi", label: "Wi-Fi", matches: (listing) => Boolean(listing.has_wifi) },
  { key: "study", label: "Study area", matches: (listing) => Boolean(listing.has_study_area) },
  { key: "laundry", label: "Laundry", matches: (listing) => Boolean(listing.has_laundry_area) },
  { key: "parking", label: "Parking", matches: (listing) => Boolean(listing.has_parking_area) },
  { key: "pets", label: "Pets allowed", matches: (listing) => Boolean(listing.pets_allowed) },
  { key: "visitors", label: "Visitors allowed", matches: (listing) => Boolean(listing.visitors_allowed) },
];

const allAreasLabel = "All areas";
const allTypesLabel = "All stay types";
const allPricesLabel = "All budgets";
const allExclusivityLabel = "All setups";
const savedListingsStorageKey = "mapaguapa:saved-listings";

function getFirstName(profile: Profile) {
  if (profile.full_name?.trim()) {
    return profile.full_name.trim().split(/\s+/)[0] ?? "Student";
  }

  if (profile.email?.includes("@")) {
    return profile.email.split("@")[0];
  }

  return "Student";
}

function getInitials(profile: Profile) {
  const source = profile.full_name?.trim() || profile.email || "MAPAGUAPA";
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((token) => token[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2);
}

function getAreaLabel(address: string | null | undefined) {
  const value = address?.trim();
  if (!value) {
    return "Baybay City";
  }

  const lowered = value.toLowerCase();
  if (lowered.includes("pangasugan")) {
    return "Pangasugan";
  }

  if (lowered.includes("guadalupe")) {
    return "Guadalupe";
  }

  return value.split(",")[0]?.trim() || "Baybay City";
}

function createSectionTitle(area: string) {
  return area === "Baybay City" ? "Student stays around Baybay City" : `Student stays around ${area}`;
}

function formatPesoLabel(label: string | null | undefined) {
  const value = label?.trim();
  if (!value || value.startsWith("₱")) {
    return value || "Not listed";
  }

  if (value === allPricesLabel) {
    return value;
  }

  const rangeMatch = value.match(/^(\d[\d,]*)(?:\s*-\s*)(\d[\d,]*)$/);
  if (rangeMatch) {
    return `₱${rangeMatch[1]}-${rangeMatch[2]}`;
  }

  const lessThanMatch = value.match(/^Less than\s+(\d[\d,]*)$/i);
  if (lessThanMatch) {
    return `Less than ₱${lessThanMatch[1]}`;
  }

  const orMoreMatch = value.match(/^(\d[\d,]*)\s+or more$/i);
  if (orMoreMatch) {
    return `₱${orMoreMatch[1]} or more`;
  }

  const exactMatch = value.match(/^(\d[\d,]*)$/);
  if (exactMatch) {
    return `₱${exactMatch[1]}`;
  }

  return value;
}

function shouldShowDetailItem(item: ModalDetailItem) {
  return !hiddenDetailValues.has(item.value.trim().toLowerCase());
}

function visibleDetailSection(section: ModalDetailSection) {
  const items = section.items.filter(shouldShowDetailItem);
  return items.length > 0 ? { ...section, items } : null;
}

function sortPhotos(listing: ListingWithPhotos | null) {
  return [...(listing?.listing_photos ?? [])].sort((left, right) => {
    if (left.is_cover !== right.is_cover) {
      return left.is_cover ? -1 : 1;
    }

    return left.sort_order - right.sort_order;
  });
}

function getPhotoUrl(photo: ListingPhotoRow | undefined) {
  return photo ? toPublicPhotoUrl(photo) : "";
}

function getListingCoordinates(listing: ListingWithPhotos | null): PropertyCoordinates | null {
  const lat = listing?.location_lat;
  const lng = listing?.location_lng;

  if (typeof lat !== "number" || typeof lng !== "number") {
    return null;
  }

  return { lat, lng };
}

export default function MapaguapaUserPage({ onSignOut, profile }: MapaguapaUserPageProps) {
  const [listings, setListings] = useState<ListingWithPhotos[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeArea, setActiveArea] = useState(allAreasLabel);
  const [activeType, setActiveType] = useState(allTypesLabel);
  const [activePrice, setActivePrice] = useState(allPricesLabel);
  const [activeExclusivity, setActiveExclusivity] = useState(allExclusivityLabel);
  const [activeFeatures, setActiveFeatures] = useState<FeatureFilterKey[]>([]);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [openListingId, setOpenListingId] = useState<string | null>(null);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [fullViewPhotoIndex, setFullViewPhotoIndex] = useState<number | null>(null);
  const [savedListingIds, setSavedListingIds] = useState<string[]>(() => {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(savedListingsStorageKey) ?? "[]");
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
    } catch {
      return [];
    }
  });
  const [contactFeedback, setContactFeedback] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(searchQuery.trim().toLowerCase());
  const {
    pageRef,
    handlePointerEnter,
    handlePointerLeave,
    handlePointerMove,
  } = usePointerGlow({ centerXRatio: 0.5, centerYRatio: 0.22 });

  useEffect(() => {
    let cancelled = false;

    const loadListings = async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await fetchActiveListings();
        if (!cancelled) {
          setListings(data);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load listings.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadListings();

    return () => {
      cancelled = true;
    };
  }, []);

  const typeOptions = useMemo(
    () => [
      allTypesLabel,
      ...Array.from(new Set(listings.map((listing) => listing.accommodation_type).filter(Boolean))),
    ],
    [listings]
  );

  const areaOptions = useMemo(
    () => [allAreasLabel, ...Array.from(new Set(listings.map((listing) => getAreaLabel(listing.address)).filter(Boolean)))],
    [listings]
  );

  const priceOptions = useMemo(
    () => [
      allPricesLabel,
      ...Array.from(new Set(listings.map((listing) => listing.monthly_rental_label).filter(Boolean))),
    ],
    [listings]
  );

  const exclusivityOptions = useMemo(
    () => [
      allExclusivityLabel,
      ...Array.from(
        new Set(listings.map((listing) => listing.exclusivity).filter((value): value is string => Boolean(value)))
      ),
    ],
    [listings]
  );

  const filteredListings = useMemo(() => {
    return listings.filter((listing) => {
      const haystack = [
        listing.name,
        listing.address,
        listing.accommodation_type,
        listing.exclusivity,
        listing.monthly_rental_label,
        listing.contact_person,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !deferredSearch || haystack.includes(deferredSearch);
      const matchesArea = activeArea === allAreasLabel || getAreaLabel(listing.address) === activeArea;
      const matchesType = activeType === allTypesLabel || listing.accommodation_type === activeType;
      const matchesPrice = activePrice === allPricesLabel || listing.monthly_rental_label === activePrice;
      const matchesExclusivity = activeExclusivity === allExclusivityLabel || (listing.exclusivity ?? "") === activeExclusivity;
      const matchesFeatures = activeFeatures.every((featureKey) => {
        const option = featureFilterOptions.find((item) => item.key === featureKey);
        return option ? option.matches(listing) : true;
      });

      return matchesSearch && matchesArea && matchesType && matchesPrice && matchesExclusivity && matchesFeatures;
    });
  }, [activeArea, activeExclusivity, activeFeatures, activePrice, activeType, deferredSearch, listings]);

  const sections = useMemo<ListingSection[]>(() => {
    const grouped = new Map<string, ListingWithPhotos[]>();

    filteredListings.forEach((listing) => {
      const area = getAreaLabel(listing.address);
      const existing = grouped.get(area) ?? [];
      existing.push(listing);
      grouped.set(area, existing);
    });

    return Array.from(grouped.entries()).map(([area, items]) => ({
      title: createSectionTitle(area),
      subtitle: `${items.length} listing${items.length > 1 ? "s" : ""} available`,
      items,
    }));
  }, [filteredListings]);

  const openListing = useMemo(
    () => listings.find((listing) => listing.id === openListingId) ?? null,
    [listings, openListingId]
  );
  const openListingPhotos = useMemo(() => sortPhotos(openListing), [openListing]);
  const activePhoto = openListingPhotos[activePhotoIndex] ?? openListingPhotos[0];
  const activePhotoUrl = getPhotoUrl(activePhoto);
  const openListingCoordinates = getListingCoordinates(openListing);
  const directionsUrl = openListingCoordinates
    ? `https://www.google.com/maps/dir/?api=1&destination=${openListingCoordinates.lat},${openListingCoordinates.lng}`
    : "";
  const firstName = getFirstName(profile);
  const initials = getInitials(profile);
  const isOpenListingSaved = openListing ? savedListingIds.includes(openListing.id) : false;
  const filteredCount = filteredListings.length.toString().padStart(2, "0");
  const totalCount = listings.length.toString().padStart(2, "0");
  const activeFilterCount =
    Number(activeArea !== allAreasLabel) +
    Number(activeType !== allTypesLabel) +
    Number(activePrice !== allPricesLabel) +
    Number(activeExclusivity !== allExclusivityLabel) +
    activeFeatures.length;
  const modalHighlights = openListing
    ? [
        { label: "Budget", value: formatPesoLabel(openListing.monthly_rental_label) },
        {
          label: "Rooms",
          value: `${openListing.rooms_available ?? 0} room${(openListing.rooms_available ?? 0) === 1 ? "" : "s"}`,
        },
        { label: "Occupancy", value: openListing.occupancy_label || "Not listed" },
        { label: "Curfew", value: openListing.curfew || "Flexible" },
      ]
    : [];
  const modalSections: ModalDetailSection[] = openListing
    ? ([
        {
          id: "overview",
          eyebrow: "Stay snapshot",
          title: "Overview",
          tone: "overview",
          items: [
            { label: "Address", value: openListing.address },
            { label: "Price range", value: formatPesoLabel(openListing.monthly_rental_label) },
            { label: "Property type", value: openListing.accommodation_type },
            { label: "Specific type", value: openListing.accommodation_type_other || "Not specified" },
            { label: "Setup", value: openListing.exclusivity || "Open to students" },
          ],
        },
        {
          id: "amenities",
          eyebrow: "Essentials",
          title: "Amenities",
          tone: "amenities",
          items: [
            { label: "Wi-Fi", value: labelBoolean(openListing.has_wifi, "Available", "Not available") },
            { label: "Study area", value: labelBoolean(openListing.has_study_area, "Available", "Not available") },
            { label: "Laundry", value: labelBoolean(openListing.has_laundry_area, "Available", "Not available") },
            { label: "Drying area", value: labelBoolean(openListing.has_drying_area, "Available", "Not available") },
            { label: "Parking", value: labelBoolean(openListing.has_parking_area, "Available", "Not available") },
            { label: "Kitchen", value: labelBoolean(openListing.has_common_kitchen, "Available", "Not listed") },
            { label: "Refrigerator", value: labelBoolean(openListing.has_refrigerator, "Available", "Not listed") },
            { label: "Television", value: labelBoolean(openListing.has_television, "Available", "Not listed") },
            { label: "Other", value: openListing.other_amenities || "No other amenities listed" },
          ],
        },
        {
          id: "rules",
          eyebrow: "House rules",
          title: "Rules and access",
          tone: "rules",
          items: [
            { label: "Curfew", value: openListing.curfew || "No curfew listed" },
            { label: "Visitors", value: labelBoolean(openListing.visitors_allowed, "Visitors allowed", "No visitors allowed") },
            { label: "Pets", value: labelBoolean(openListing.pets_allowed, "Allowed", "Not allowed") },
            { label: "Smoking", value: labelBoolean(openListing.smoking_allowed, "Smoking allowed", "Smoking prohibited") },
            { label: "CCTV", value: labelBoolean(openListing.has_security_cctv, "Listed", "Not listed") },
            { label: "Emergency exit", value: labelBoolean(openListing.has_emergency_exit, "Listed", "Not listed") },
            { label: "Fire alarm", value: labelBoolean(openListing.has_fire_alarm, "Listed", "Not listed") },
            { label: "Emergency lights", value: labelBoolean(openListing.has_emergency_lights, "Listed", "Not listed") },
            { label: "Fire extinguisher", value: labelBoolean(openListing.has_fire_extinguisher, "Listed", "Not listed") },
            { label: "Smoke detector", value: labelBoolean(openListing.has_smoke_detector, "Listed", "Not listed") },
            { label: "Sprinkler", value: labelBoolean(openListing.has_sprinkler, "Listed", "Not listed") },
          ],
        },
        {
          id: "utilities",
          eyebrow: "Connectivity",
          title: "Utilities and signals",
          tone: "utilities",
          items: [
            { label: "Signals", value: formatSignals(openListing.cellular_signals, openListing.cellular_signals_raw) },
            { label: "Included bills", value: openListing.bills_included || "No included bills listed" },
            { label: "Excluded bills", value: openListing.bills_not_included || "No excluded bills listed" },
            {
              label: "Utilities",
              value: labelBoolean(openListing.utilities_included, "Included", "Billed separately"),
            },
            {
              label: "Appliance fee",
              value: openListing.has_additional_appliance_fee
                ? openListing.appliance_fee_label || "Extra appliance fee applies"
                : "No extra appliance fee",
            },
          ],
        },
        {
          id: "comfort",
          eyebrow: "Everyday comfort",
          title: "Bathrooms and comfort",
          tone: "comfort",
          items: [
            {
              label: "Comfort room",
              value: labelBoolean(
                openListing.has_comfort_room_each_room,
                "In each room",
                "Shared comfort room setup"
              ),
            },
            {
              label: "Bathroom by floor",
              value: labelBoolean(openListing.has_bathroom_each_floor, "Available", "Not listed"),
            },
            { label: "Separate CR/bath", value: labelBoolean(openListing.comfort_rooms_separate_from_bathrooms, "Yes", "Not listed") },
            { label: "Comfort rooms", value: openListing.comfort_room_count == null ? "Not listed" : String(openListing.comfort_room_count) },
            { label: "Bathrooms", value: openListing.bathroom_count == null ? "Not listed" : String(openListing.bathroom_count) },
            { label: "Charging slots", value: labelBoolean(openListing.has_charging_slots_each_room, "Available", "Not listed") },
            { label: "Charging stations", value: openListing.charging_station_count_label || (openListing.charging_station_count == null ? "Not listed" : String(openListing.charging_station_count)) },
            { label: "Electric fans", value: labelBoolean(openListing.has_electric_fans, "Available", "Not listed") },
            { label: "Aircon", value: labelBoolean(openListing.has_aircon, "Available", "Not listed") },
            { label: "Aircon rooms", value: openListing.aircon_room_count == null ? "Not listed" : String(openListing.aircon_room_count) },
          ],
        },
        {
          id: "contact",
          eyebrow: "Reach out",
          title: "Owner contact",
          tone: "contact",
          items: [
            { label: "Contact person", value: openListing.contact_person || "No contact person listed" },
            { label: "Phone", value: openListing.contact_number || "No contact number listed" },
            {
              label: "Other details",
              value: openListing.other_contact_information || "No extra contact information",
            },
            { label: "Property fenced", value: labelBoolean(openListing.is_fenced, "Yes", "Not listed") },
          ],
        },
      ] as ModalDetailSection[]).map(visibleDetailSection).filter((section): section is ModalDetailSection => Boolean(section))
    : [];

  useEffect(() => {
    setActivePhotoIndex(0);
    setFullViewPhotoIndex(null);
    setContactFeedback(null);
  }, [openListingId]);

  useEffect(() => {
    window.localStorage.setItem(savedListingsStorageKey, JSON.stringify(savedListingIds));
  }, [savedListingIds]);

  useEffect(() => {
    if (!openListing) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (fullViewPhotoIndex !== null) {
          setFullViewPhotoIndex(null);
          return;
        }

        setOpenListingId(null);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [fullViewPhotoIndex, openListing]);

  const openPhotoFullView = (index: number) => {
    if (!getPhotoUrl(openListingPhotos[index])) {
      return;
    }

    setActivePhotoIndex(index);
    setFullViewPhotoIndex(index);
  };

  const toggleFeatureFilter = (featureKey: FeatureFilterKey) => {
    setActiveFeatures((current) =>
      current.includes(featureKey) ? current.filter((value) => value !== featureKey) : [...current, featureKey]
    );
  };

  const clearFilters = () => {
    setSearchQuery("");
    setActiveArea(allAreasLabel);
    setActiveType(allTypesLabel);
    setActivePrice(allPricesLabel);
    setActiveExclusivity(allExclusivityLabel);
    setActiveFeatures([]);
  };

  const toggleSavedListing = (listingId: string) => {
    setSavedListingIds((current) =>
      current.includes(listingId) ? current.filter((id) => id !== listingId) : [...current, listingId]
    );
  };

  const copyContactNumber = async () => {
    if (!openListing?.contact_number) {
      setContactFeedback("No contact number is listed for this property.");
      return;
    }

    try {
      await navigator.clipboard.writeText(openListing.contact_number);
      setContactFeedback("Contact number copied.");
    } catch {
      setContactFeedback(openListing.contact_number);
    }
  };

  return (
    <main
      className="mapa-user-page"
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onPointerMove={handlePointerMove}
      ref={pageRef}
    >
      <div className="mapa-user-page__orb mapa-user-page__orb--left" />
      <div className="mapa-user-page__orb mapa-user-page__orb--right" />
      <div className="mapa-user-page__grid" />
      <div className="mapa-user-page__mouse-glow" />
      <div className="mapa-user-page__mouse-warp" />

      <div className="mapa-user-page__shell">
        <header className="mapa-user-page__topbar">
          <div className="mapa-user-page__brand">
            <div className="mapa-user-page__brand-icon">
              <HouseMark className="mapa-user-page__house-icon" />
            </div>
            <div>
              <p className="mapa-user-page__brand-wordmark">MAPAGUAPA</p>
            </div>
          </div>

          <div className="mapa-user-page__searchbar">
            <label className="mapa-user-page__search-field">
              <span className="mapa-user-page__search-label">Search destination</span>
              <input
                className="mapa-user-page__search-input"
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search by listing name, area, owner, or address"
                type="text"
                value={searchQuery}
              />
            </label>
            <div className="mapa-user-page__search-status">
              <span>{filteredCount} matches</span>
              <span>{totalCount} total listings</span>
            </div>
          </div>

          <div className="mapa-user-page__account-panel">
            <div className="mapa-user-page__account-chip">
              <div className="mapa-user-page__avatar">{initials}</div>
              <div>
                <p className="mapa-user-page__account-label">Signed in</p>
                <strong>{firstName}</strong>
              </div>
            </div>
            <button className="mapa-user-page__signout" onClick={() => void onSignOut()} type="button">
              Sign out
            </button>
          </div>

          <div className="mapa-user-page__mobile-account">
            <button
              aria-expanded={isAccountMenuOpen}
              aria-haspopup="menu"
              aria-label="Open account menu"
              className="mapa-user-page__menu-button"
              onClick={() => setIsAccountMenuOpen((current) => !current)}
              type="button"
            >
              <span />
              <span />
              <span />
            </button>
            <div className={`mapa-user-page__account-menu${isAccountMenuOpen ? " is-open" : ""}`} role="menu">
              <div className="mapa-user-page__account-menu-row">
                <div className="mapa-user-page__avatar">{initials}</div>
                <div>
                  <p className="mapa-user-page__account-label">Signed in</p>
                  <strong>{firstName}</strong>
                </div>
              </div>
              <button className="mapa-user-page__account-menu-signout" onClick={() => void onSignOut()} role="menuitem" type="button">
                Sign out
              </button>
            </div>
          </div>
        </header>

        <section className="mapa-user-page__filters-panel">
          <div className="mapa-user-page__filters-head">
            <div>
              <h3 className="mapa-user-page__filters-title">Filters</h3>
            </div>
            <div className="mapa-user-page__filters-actions">
              <div className="mapa-user-page__filters-status">
                <span className="mapa-user-page__filters-status-dot" />
                <strong>{activeFilterCount.toString().padStart(2, "0")}</strong>
                <span>{activeFilterCount === 1 ? "filter active" : "filters active"}</span>
              </div>
              {activeFilterCount > 0 && (
                <button className="mapa-user-page__filters-clear" onClick={clearFilters} type="button">
                  Clear all
                </button>
              )}
              <button
                aria-controls="mapa-user-filters"
                aria-expanded={isFiltersOpen}
                className="mapa-user-page__filters-toggle"
                onClick={() => setIsFiltersOpen((current) => !current)}
                type="button"
              >
                {isFiltersOpen ? "Hide filters" : "Show filters"}
              </button>
            </div>
          </div>

          {isFiltersOpen && (
          <div className="mapa-user-page__filters-body is-open" id="mapa-user-filters">
            <div className="mapa-user-page__filters-grid">
              <div className="mapa-user-page__filters-group">
                <div className="mapa-user-page__filters-group-head">
                  <p className="mapa-user-page__filter-title">Area</p>
                  <span className="mapa-user-page__filters-meta">{areaOptions.length - 1} zones</span>
                </div>
                <div className="mapa-user-page__chip-row">
                  {areaOptions.map((option) => (
                    <button
                      className={`mapa-user-page__filter-chip${activeArea === option ? " is-active" : ""}`}
                      key={option}
                      onClick={() => setActiveArea(option)}
                      type="button"
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mapa-user-page__filters-group">
                <div className="mapa-user-page__filters-group-head">
                  <p className="mapa-user-page__filter-title">Stay type</p>
                  <span className="mapa-user-page__filters-meta">{typeOptions.length - 1} options</span>
                </div>
                <div className="mapa-user-page__chip-row">
                  {typeOptions.map((option) => (
                    <button
                      className={`mapa-user-page__filter-chip${activeType === option ? " is-active" : ""}`}
                      key={option}
                      onClick={() => setActiveType(option)}
                      type="button"
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mapa-user-page__filters-group">
                <div className="mapa-user-page__filters-group-head">
                  <p className="mapa-user-page__filter-title">Budget</p>
                  <span className="mapa-user-page__filters-meta">{priceOptions.length - 1} ranges</span>
                </div>
                <div className="mapa-user-page__chip-row">
                  {priceOptions.map((option) => (
                    <button
                      className={`mapa-user-page__filter-chip${activePrice === option ? " is-active" : ""}`}
                      key={option}
                      onClick={() => setActivePrice(option)}
                      type="button"
                    >
                      {formatPesoLabel(option)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mapa-user-page__filters-group">
                <div className="mapa-user-page__filters-group-head">
                  <p className="mapa-user-page__filter-title">Setup</p>
                  <span className="mapa-user-page__filters-meta">{exclusivityOptions.length - 1} setups</span>
                </div>
                <div className="mapa-user-page__chip-row">
                  {exclusivityOptions.map((option) => (
                    <button
                      className={`mapa-user-page__filter-chip${activeExclusivity === option ? " is-active" : ""}`}
                      key={option}
                      onClick={() => setActiveExclusivity(option)}
                      type="button"
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mapa-user-page__filters-group mapa-user-page__filters-group--wide">
                <div className="mapa-user-page__filters-group-head">
                  <p className="mapa-user-page__filter-title">Amenities and rules</p>
                  <span className="mapa-user-page__filters-meta">{featureFilterOptions.length} essentials</span>
                </div>
                <div className="mapa-user-page__chip-row">
                  {featureFilterOptions.map((option) => (
                    <button
                      className={`mapa-user-page__filter-chip${activeFeatures.includes(option.key) ? " is-active" : ""}`}
                      key={option.key}
                      onClick={() => toggleFeatureFilter(option.key)}
                      type="button"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          )}
        </section>

        {loading && <p className="mapa-user-page__feedback">Loading listings from Supabase...</p>}
        {error && <p className="mapa-user-page__feedback mapa-user-page__feedback--error">{error}</p>}

        {!loading && !error && listings.length === 0 && (
          <p className="mapa-user-page__feedback">No active listings are available yet.</p>
        )}

        {!loading && !error && listings.length > 0 && filteredListings.length === 0 && (
          <article className="mapa-user-page__empty-state">
            <p className="mapa-user-page__eyebrow">No matching stays</p>
            <h3>Try another search or switch filters.</h3>
            <p>Once the filters loosen up, the available properties will appear here again.</p>
          </article>
        )}

        {!loading && !error && sections.length > 0 && (
          <div className="mapa-user-page__sections">
            {sections.map((section) => (
              <section className="mapa-user-page__listing-section" key={section.title}>
                <div className="mapa-user-page__section-head">
                  <div>
                    <p className="mapa-user-page__eyebrow">Available now</p>
                    <h2 className="mapa-user-page__section-title">{section.title}</h2>
                  </div>
                  <div className="mapa-user-page__section-status" aria-label={section.subtitle}>
                    <span className="mapa-user-page__section-status-dot" />
                    <strong>{section.items.length.toString().padStart(2, "0")}</strong>
                    <span>{section.items.length === 1 ? "listing available" : "listings available"}</span>
                  </div>
                </div>

                <div className="mapa-user-page__listing-grid">
                  {section.items.map((listing) => {
                    const cover = getListingCover(listing);
                    return (
                      <button
                        className="mapa-user-page__listing-card"
                        key={listing.id}
                        onClick={() => setOpenListingId(listing.id)}
                        type="button"
                      >
                        <div
                          className="mapa-user-page__listing-image"
                          style={cover ? { backgroundImage: `linear-gradient(180deg, rgba(17, 39, 29, 0.05), rgba(17, 39, 29, 0.34)), url(${cover})` } : undefined}
                        >
                          <span className="mapa-user-page__listing-badge">{listing.accommodation_type}</span>
                        </div>

                        <div className="mapa-user-page__listing-body">
                          <div className="mapa-user-page__listing-head">
                            <div>
                              <h3 className="mapa-user-page__listing-title">{listing.name}</h3>
                              <p className="mapa-user-page__listing-address">{listing.address}</p>
                            </div>
                            <span className="mapa-user-page__listing-price">{formatPesoLabel(listing.monthly_rental_label)}</span>
                          </div>

                          <p className="mapa-user-page__listing-summary">{fallbackDescription(listing)}</p>

                          <div className="mapa-user-page__tag-row">
                            <span>{listing.exclusivity || "Open"}</span>
                            <span>{listing.rooms_available ?? 0} rooms</span>
                            <span>{labelBoolean(listing.has_wifi, "Wi-Fi", "No Wi-Fi")}</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}

        <p className="mapa-user-page__powered-by">
          <span>Powered by</span>
          <a href="https://boyles-christian-portfolio.vercel.app/" rel="noreferrer" target="_blank">
            Lily Tech Solutions Co.
          </a>
        </p>
      </div>

      {openListing && (
        <div className="mapa-user-page__modal" role="dialog" aria-modal="true" aria-label={`${openListing.name} details`}>
          <button className="mapa-user-page__modal-backdrop" onClick={() => setOpenListingId(null)} type="button" />
          <div className="mapa-user-page__modal-panel">
            <div className="mapa-user-page__modal-topbar">
              <div>
                <p className="mapa-user-page__eyebrow">Property details</p>
                <h2 className="mapa-user-page__modal-title">{openListing.name}</h2>
                <p className="mapa-user-page__listing-address">{openListing.address}</p>
              </div>
              <div className="mapa-user-page__modal-actions">
                <span className="mapa-user-page__modal-price">{formatPesoLabel(openListing.monthly_rental_label)}</span>
                <button className="mapa-user-page__modal-close" onClick={() => toggleSavedListing(openListing.id)} type="button">
                  {isOpenListingSaved ? "Saved" : "Save"}
                </button>
                <button className="mapa-user-page__modal-close" onClick={() => setOpenListingId(null)} type="button">
                  Close
                </button>
              </div>
            </div>

            <div className="mapa-user-page__modal-layout">
              <div className="mapa-user-page__modal-media">
                <button
                  aria-label={`Open ${openListing.name} cover photo in full view`}
                  className="mapa-user-page__modal-hero"
                  onClick={() => openPhotoFullView(activePhotoIndex)}
                  style={
                    activePhotoUrl
                      ? {
                          backgroundImage: `linear-gradient(180deg, rgba(17, 39, 29, 0.05), rgba(17, 39, 29, 0.4)), url(${activePhotoUrl})`,
                        }
                      : undefined
                  }
                  type="button"
                >
                  <div className="mapa-user-page__modal-hero-overlay">
                    <div className="mapa-user-page__modal-hero-copy">
                      <p className="mapa-user-page__modal-hero-label">MAPAGUAPA stay</p>
                      <h3 className="mapa-user-page__modal-hero-title">{openListing.name}</h3>
                      <p className="mapa-user-page__modal-hero-address">{openListing.address}</p>
                    </div>
                    <div className="mapa-user-page__modal-hero-tags">
                      <span>{formatPesoLabel(openListing.monthly_rental_label)}</span>
                      <span>{openListing.accommodation_type}</span>
                    </div>
                  </div>
                </button>

                {openListingPhotos.length > 1 && (
                  <div className="mapa-user-page__modal-filmstrip">
                    {openListingPhotos.map((photo, index) => {
                      const thumbUrl = getPhotoUrl(photo);
                      return (
                        <button
                          className={`mapa-user-page__modal-thumb${index === activePhotoIndex ? " is-active" : ""}`}
                          key={photo.id}
                          onClick={() => openPhotoFullView(index)}
                          style={thumbUrl ? { backgroundImage: `url(${thumbUrl})` } : undefined}
                          type="button"
                          aria-label={`Open photo ${index + 1} in full view`}
                        />
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="mapa-user-page__modal-summary">
                <div className="mapa-user-page__modal-intro-card">
                  <p className="mapa-user-page__modal-description">{fallbackDescription(openListing)}</p>
                  <div className="mapa-user-page__modal-tags">
                    <span>{openListing.accommodation_type}</span>
                    <span>{openListing.exclusivity || "Open to students"}</span>
                    <span>{openListing.occupancy_label || "Occupancy not listed"}</span>
                    <span>{openListing.floors_label || "Floor info not listed"}</span>
                    <span>{openListing.rooms_available ?? 0} rooms</span>
                  </div>
                </div>

                <div className="mapa-user-page__modal-highlights">
                  {modalHighlights.map((highlight) => (
                    <article className="mapa-user-page__modal-highlight" key={highlight.label}>
                      <p>{highlight.label}</p>
                      <strong>{highlight.value}</strong>
                    </article>
                  ))}
                </div>
              </div>

              <div className="mapa-user-page__modal-grid">
                {modalSections.map((section) => (
                  <article className={`mapa-user-page__modal-card mapa-user-page__modal-card--${section.tone}`} key={section.id}>
                    <div className="mapa-user-page__modal-card-head">
                      <p className="mapa-user-page__modal-card-eyebrow">{section.eyebrow}</p>
                      <h4>{section.title}</h4>
                    </div>

                    <div className="mapa-user-page__modal-card-list">
                      {section.items.map((item) => (
                        <div className="mapa-user-page__modal-card-row" key={item.label}>
                          <span>{item.label}</span>
                          <strong>{item.value}</strong>
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>

              {openListingCoordinates && (
                <section className="mapa-user-page__modal-location">
                  <div className="mapa-user-page__modal-location-head">
                    <div>
                      <p className="mapa-user-page__modal-card-eyebrow">Location</p>
                      <h4>Property map</h4>
                      <p>{openListing.address}</p>
                    </div>
                    <a className="mapa-user-page__directions-link" href={directionsUrl} rel="noreferrer" target="_blank">
                      Get Directions
                    </a>
                  </div>
                  <PropertyMap coordinates={openListingCoordinates} mode="readonly" />
                </section>
              )}

              <section className="mapa-user-page__modal-contact-actions">
                <button className="mapa-user-page__contact-action" onClick={copyContactNumber} type="button">
                  Copy number
                </button>
                {openListing.contact_number && (
                  <>
                    <a className="mapa-user-page__contact-action" href={`tel:${openListing.contact_number}`}>
                      Call
                    </a>
                    <a className="mapa-user-page__contact-action" href={`sms:${openListing.contact_number}`}>
                      SMS
                    </a>
                  </>
                )}
                {contactFeedback && <p className="mapa-user-page__contact-feedback">{contactFeedback}</p>}
              </section>
            </div>
          </div>

          {fullViewPhotoIndex !== null && (
            <div
              aria-label={`${openListing.name} photo full view`}
              aria-modal="true"
              className="mapa-user-page__photo-viewer"
              role="dialog"
            >
              <button
                aria-label="Close full view photo"
                className="mapa-user-page__photo-viewer-backdrop"
                onClick={() => setFullViewPhotoIndex(null)}
                type="button"
              />
              <div className="mapa-user-page__photo-viewer-panel">
                <button
                  aria-label="Close full view photo"
                  className="mapa-user-page__photo-viewer-close"
                  onClick={() => setFullViewPhotoIndex(null)}
                  type="button"
                >
                  X
                </button>
                <img
                  alt={openListingPhotos[fullViewPhotoIndex]?.alt_text || `${openListing.name} photo ${fullViewPhotoIndex + 1}`}
                  className="mapa-user-page__photo-viewer-image"
                  src={getPhotoUrl(openListingPhotos[fullViewPhotoIndex])}
                />
                {openListingPhotos.length > 1 && (
                  <div className="mapa-user-page__photo-viewer-strip" aria-label="Choose another photo">
                    {openListingPhotos.map((photo, index) => {
                      const thumbUrl = getPhotoUrl(photo);
                      return (
                        <button
                          aria-label={`Show photo ${index + 1}`}
                          className={`mapa-user-page__photo-viewer-thumb${index === fullViewPhotoIndex ? " is-active" : ""}`}
                          key={photo.id}
                          onClick={() => {
                            setActivePhotoIndex(index);
                            setFullViewPhotoIndex(index);
                          }}
                          style={thumbUrl ? { backgroundImage: `url(${thumbUrl})` } : undefined}
                          type="button"
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
