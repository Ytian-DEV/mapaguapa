import { useEffect, useMemo, useState } from "react";
import HouseMark from "../shared/HouseMark";
import { PropertyMap, type PropertyCoordinates } from "../shared/PropertyMap";
import { usePointerGlow } from "../shared/usePointerGlow";
import {
  fetchListingCards,
  fetchListingAreasForFilters,
  fetchListingDetail,
  fetchListingFilterOptions,
  fetchSavedListingCards,
  saveListingForUser,
  unsaveListingForUser,
  type ListingFilters,
} from "../../lib/listingService";
import {
  fallbackDescription,
  formatSignals,
  getListingCardCover,
  labelBoolean,
  toPublicPhotoUrl,
  type ListingCardSummary,
  type ListingPhotoRow,
  type ListingWithPhotos,
  type Profile,
} from "../../lib/models";
import "./mapaguapa-user.css";

type MapaguapaUserPageProps = {
  onNavigateAbout: () => void;
  onSignOut: () => Promise<void>;
  profile: Profile;
};

type ListingSection = {
  area: string;
  title: string;
  subtitle: string;
  items: ListingCardSummary[];
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
  matches: (listing: ListingCardSummary) => boolean;
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
const allExclusivityLabel = "All setups";
const AREA_PAGE_SIZE = 4;
type UserView = "listings" | "saved";
type AreaListingState = Record<string, ListingCardSummary[]>;
type AreaPageState = Record<string, number>;
type AreaBooleanState = Record<string, boolean>;
const INITIAL_AREA_CONCURRENCY = 2;

type PriceInterval = {
  min: number;
  max: number;
};

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

function parseBudgetValue(value: string) {
  const parsed = Number(value.replace(/[^\d.]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function parsePriceIntervals(label: string | null | undefined): PriceInterval[] {
  const normalized = label
    ?.replace(/[₱â‚±]/g, "")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  if (!normalized) {
    return [];
  }

  const intervals: PriceInterval[] = [];
  const rangePattern = /(\d[\d,]*)\s*-\s*(\d[\d,]*)/g;
  let rangeMatch: RegExpExecArray | null;

  while ((rangeMatch = rangePattern.exec(normalized))) {
    const first = parseBudgetValue(rangeMatch[1]);
    const second = parseBudgetValue(rangeMatch[2]);

    if (first !== null && second !== null) {
      intervals.push({ min: Math.min(first, second), max: Math.max(first, second) });
    }
  }

  const lessThanMatch = normalized.match(/(?:less than|<)\s*(\d[\d,]*)/);
  if (lessThanMatch) {
    const max = parseBudgetValue(lessThanMatch[1]);
    if (max !== null) {
      intervals.push({ min: 0, max });
    }
  }

  const orMoreMatch = normalized.match(/(\d[\d,]*)\s*(?:or more|\+)/);
  if (orMoreMatch) {
    const min = parseBudgetValue(orMoreMatch[1]);
    if (min !== null) {
      intervals.push({ min, max: Number.POSITIVE_INFINITY });
    }
  }

  if (intervals.length === 0) {
    const exactMatch = normalized.match(/\d[\d,]*/);
    const exact = exactMatch ? parseBudgetValue(exactMatch[0]) : null;

    if (exact !== null) {
      intervals.push({ min: exact, max: exact });
    }
  }

  return intervals;
}

function doesPriceMatchBudget(label: string | null | undefined, minBudget: number | null, maxBudget: number | null) {
  if (minBudget === null && maxBudget === null) {
    return true;
  }

  const intervals = parsePriceIntervals(label);
  if (intervals.length === 0) {
    return false;
  }

  const selectedMin = minBudget ?? 0;
  const selectedMax = maxBudget ?? Number.POSITIVE_INFINITY;
  return intervals.some((interval) => interval.max >= selectedMin && interval.min <= selectedMax);
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

export default function MapaguapaUserPage({ onNavigateAbout, onSignOut, profile }: MapaguapaUserPageProps) {
  const [areaListings, setAreaListings] = useState<AreaListingState>({});
  const [areaPages, setAreaPages] = useState<AreaPageState>({});
  const [areaHasMore, setAreaHasMore] = useState<AreaBooleanState>({});
  const [areaLoading, setAreaLoading] = useState<AreaBooleanState>({});
  const [filteredAreas, setFilteredAreas] = useState<string[] | null>(null);
  const [availableAreas, setAvailableAreas] = useState<string[]>([]);
  const [availableTypes, setAvailableTypes] = useState<string[]>([]);
  const [availableExclusivities, setAvailableExclusivities] = useState<string[]>([]);
  const [view, setView] = useState<UserView>(() => (window.location.pathname === "/dashboard/saved" ? "saved" : "listings"));
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [activeArea, setActiveArea] = useState(allAreasLabel);
  const [activeType, setActiveType] = useState(allTypesLabel);
  const [minBudget, setMinBudget] = useState("");
  const [maxBudget, setMaxBudget] = useState("");
  const [activeExclusivity, setActiveExclusivity] = useState(allExclusivityLabel);
  const [activeFeatures, setActiveFeatures] = useState<FeatureFilterKey[]>([]);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [openListingId, setOpenListingId] = useState<string | null>(null);
  const [openListing, setOpenListing] = useState<ListingWithPhotos | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [fullViewPhotoIndex, setFullViewPhotoIndex] = useState<number | null>(null);
  const [savedListingIds, setSavedListingIds] = useState<string[]>([]);
  const [savedListings, setSavedListings] = useState<ListingCardSummary[]>([]);
  const [savingListingId, setSavingListingId] = useState<string | null>(null);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const [contactFeedback, setContactFeedback] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const {
    pageRef,
    handlePointerEnter,
    handlePointerLeave,
    handlePointerMove,
  } = usePointerGlow({ centerXRatio: 0.5, centerYRatio: 0.22 });

  const buildListingFilters = (areaOverride?: string): ListingFilters => {
    const parsedMinBudget = minBudget.trim() ? parseBudgetValue(minBudget) : null;
    const parsedMaxBudget = maxBudget.trim() ? parseBudgetValue(maxBudget) : null;

    return {
      search: debouncedSearchQuery,
      area: areaOverride ?? (activeArea === allAreasLabel ? undefined : activeArea),
      accommodationType: activeType === allTypesLabel ? undefined : activeType,
      minBudget: parsedMinBudget,
      maxBudget: parsedMaxBudget,
      exclusivity: activeExclusivity === allExclusivityLabel ? undefined : activeExclusivity,
      features: activeFeatures,
    };
  };

  const loadAreaPage = async (area: string, page: number, mode: "replace" | "append") => {
    setAreaLoading((current) => ({ ...current, [area]: true }));
    setError(null);

    try {
      const result = await fetchListingCards({
        page,
        pageSize: AREA_PAGE_SIZE,
        filters: buildListingFilters(area),
      });

      setAreaListings((current) => {
        const existing = mode === "replace" ? [] : current[area] ?? [];
        const existingIds = new Set(existing.map((listing) => listing.id));
        return {
          ...current,
          [area]: [...existing, ...result.listings.filter((listing) => !existingIds.has(listing.id))],
        };
      });
      setAreaPages((current) => ({ ...current, [area]: page }));
      setAreaHasMore((current) => ({ ...current, [area]: result.hasMore }));
    } catch (loadError) {
      console.error("Listing query failed", loadError);
      setError("Listings could not be loaded. Please check your connection and try again.");
    } finally {
      setAreaLoading((current) => ({ ...current, [area]: false }));
    }
  };

  const getVisibleAreas = () => {
    if (activeArea !== allAreasLabel) {
      return [activeArea];
    }

    return filteredAreas ?? availableAreas;
  };

  useEffect(() => {
    let cancelled = false;

    const loadFilterOptions = async () => {
      try {
        const options = await fetchListingFilterOptions();
        if (!cancelled) {
          setAvailableAreas(options.areas);
          setAvailableTypes(options.accommodationTypes);
          setAvailableExclusivities(options.exclusivities);
        }
      } catch (loadError) {
        if (!cancelled) {
          console.error("Listing filter options query failed", loadError);
          setError("Filter options could not be loaded. Please refresh and try again.");
        }
      }
    };

    void loadFilterOptions();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 400);

    return () => window.clearTimeout(timeoutId);
  }, [searchQuery]);

  useEffect(() => {
    const parsedMinBudget = minBudget.trim() ? parseBudgetValue(minBudget) : null;
    const parsedMaxBudget = maxBudget.trim() ? parseBudgetValue(maxBudget) : null;
    const hasInvalidRange =
      parsedMinBudget !== null && parsedMaxBudget !== null && parsedMinBudget > parsedMaxBudget;

    if (hasInvalidRange) {
      setAreaListings({});
      setAreaPages({});
      setAreaHasMore({});
      setFilteredAreas(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setAreaListings({});
    setAreaPages({});
    setAreaHasMore({});

    const loadInitialAreas = async () => {
      const baseFilters = buildListingFilters(activeArea === allAreasLabel ? undefined : activeArea);
      const hasScopedFilters =
        Boolean(baseFilters.search?.trim()) ||
        Boolean(baseFilters.accommodationType?.trim()) ||
        Boolean(baseFilters.exclusivity?.trim()) ||
        typeof baseFilters.minBudget === "number" ||
        typeof baseFilters.maxBudget === "number" ||
        (baseFilters.features?.length ?? 0) > 0;
      const visibleAreas =
        activeArea !== allAreasLabel
          ? [activeArea]
          : hasScopedFilters
            ? await fetchListingAreasForFilters(baseFilters)
            : availableAreas;

      if (cancelled) {
        return;
      }

      setFilteredAreas(activeArea === allAreasLabel && hasScopedFilters ? visibleAreas : null);

      if (visibleAreas.length === 0) {
        setLoading(false);
        return;
      }

      for (let index = 0; index < visibleAreas.length; index += INITIAL_AREA_CONCURRENCY) {
        const areaBatch = visibleAreas.slice(index, index + INITIAL_AREA_CONCURRENCY);
        await Promise.all(areaBatch.map((area) => loadAreaPage(area, 0, "replace")));
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadInitialAreas().catch((loadError) => {
      if (!cancelled) {
        console.error("Initial listing load failed", loadError);
        setError("Listings could not be loaded. Please check your connection and try again.");
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [activeArea, activeExclusivity, activeFeatures, activeType, availableAreas, debouncedSearchQuery, maxBudget, minBudget]);

  useEffect(() => {
    const syncViewFromPath = () => {
      setView(window.location.pathname === "/dashboard/saved" ? "saved" : "listings");
    };

    window.addEventListener("popstate", syncViewFromPath);
    return () => window.removeEventListener("popstate", syncViewFromPath);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadSavedListings = async () => {
      try {
        const result = await fetchSavedListingCards(profile.id);
        if (!cancelled) {
          setSavedListingIds(result.ids);
          setSavedListings(result.listings);
        }
      } catch (loadError) {
        if (!cancelled) {
          console.error("Saved listings query failed", loadError);
          setSaveFeedback("Saved listings could not be loaded.");
        }
      }
    };

    void loadSavedListings();

    return () => {
      cancelled = true;
    };
  }, [profile.id]);

  const typeOptions = useMemo(
    () => [allTypesLabel, ...availableTypes],
    [availableTypes]
  );

  const areaOptions = useMemo(
    () => [allAreasLabel, ...availableAreas],
    [availableAreas]
  );

  const exclusivityOptions = useMemo(
    () => [allExclusivityLabel, ...availableExclusivities],
    [availableExclusivities]
  );

  const listings = useMemo(() => Object.values(areaListings).flat(), [areaListings]);

  const sections = useMemo<ListingSection[]>(() => {
    return getVisibleAreas().map((area) => {
      const items = areaListings[area] ?? [];
      return {
      title: createSectionTitle(area),
      subtitle: `${items.length} listing${items.length > 1 ? "s" : ""} available`,
      area,
      items,
    };
    });
  }, [activeArea, areaListings, availableAreas, filteredAreas]);
  const visibleSections = useMemo(
    () => sections.filter((section) => section.items.length > 0),
    [sections]
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
  const filteredCount = listings.length.toString().padStart(2, "0");
  const totalCount = listings.length.toString().padStart(2, "0");
  const minBudgetValue = minBudget.trim() ? parseBudgetValue(minBudget) : null;
  const maxBudgetValue = maxBudget.trim() ? parseBudgetValue(maxBudget) : null;
  const hasBudgetFilter = minBudget.trim() !== "" || maxBudget.trim() !== "";
  const hasInvalidBudgetRange =
    minBudgetValue !== null && maxBudgetValue !== null && minBudgetValue > maxBudgetValue;
  const activeFilterCount =
    Number(activeArea !== allAreasLabel) +
    Number(activeType !== allTypesLabel) +
    Number(hasBudgetFilter) +
    Number(activeExclusivity !== allExclusivityLabel) +
    activeFeatures.length;
  const hasSearchFilter = debouncedSearchQuery.trim() !== "";
  const hasAnyListingFilter = activeFilterCount > 0 || hasSearchFilter;
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
    if (!openListingId) {
      setOpenListing(null);
      setDetailError(null);
      setDetailLoading(false);
      return;
    }

    let cancelled = false;
    setDetailLoading(true);
    setDetailError(null);

    void fetchListingDetail(openListingId)
      .then((listing) => {
        if (!cancelled) {
          setOpenListing(listing);
          if (!listing) {
            setDetailError("This listing is no longer available.");
          }
        }
      })
      .catch((detailLoadError) => {
        if (!cancelled) {
          console.error("Listing detail query failed", detailLoadError);
          setOpenListing(null);
          setDetailError("Listing details could not be loaded. Please try again.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setDetailLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [openListingId]);

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
    setMinBudget("");
    setMaxBudget("");
    setActiveExclusivity(allExclusivityLabel);
    setActiveFeatures([]);
  };

  const clearBudgetFilter = () => {
    setMinBudget("");
    setMaxBudget("");
  };

  const loadMoreListings = (area: string) => {
    if (areaLoading[area] || loading || !areaHasMore[area]) {
      return;
    }

    void loadAreaPage(area, (areaPages[area] ?? 0) + 1, "append");
  };

  const navigateUserView = (nextView: UserView) => {
    const path = nextView === "saved" ? "/dashboard/saved" : "/dashboard";
    if (window.location.pathname !== path) {
      window.history.pushState(null, "", path);
    }
    setView(nextView);
    setIsAccountMenuOpen(false);
  };

  const handleLogoClick = () => {
    navigateUserView("listings");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toggleSavedListing = async (listingId: string) => {
    const wasSaved = savedListingIds.includes(listingId);
    const nextIds = wasSaved ? savedListingIds.filter((id) => id !== listingId) : [...savedListingIds, listingId];

    setSavingListingId(listingId);
    setSaveFeedback(null);
    setSavedListingIds(nextIds);
    setSavedListings((current) => {
      if (wasSaved) {
        return current.filter((listing) => listing.id !== listingId);
      }

      const existing = current.find((listing) => listing.id === listingId);
      const listingToAdd = existing ?? listings.find((listing) => listing.id === listingId);
      return listingToAdd ? [...current, listingToAdd] : current;
    });

    try {
      if (wasSaved) {
        await unsaveListingForUser(profile.id, listingId);
      } else {
        await saveListingForUser(profile.id, listingId);
      }
    } catch (saveError) {
      setSavedListingIds(savedListingIds);
      void fetchSavedListingCards(profile.id)
        .then((result) => {
          setSavedListingIds(result.ids);
          setSavedListings(result.listings);
        })
        .catch(() => undefined);
      setSaveFeedback(saveError instanceof Error ? saveError.message : "Save failed. Please try again.");
    } finally {
      setSavingListingId(null);
    }
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

  const renderListingCard = (listing: ListingCardSummary) => {
    const cover = getListingCardCover(listing);
    const isSaved = savedListingIds.includes(listing.id);

    return (
      <article className="mapa-user-page__listing-card" key={listing.id}>
        <button
          className="mapa-user-page__listing-card-main"
          onClick={() => setOpenListingId(listing.id)}
          type="button"
        >
          <div className="mapa-user-page__listing-image">
            {cover && (
              <img
                alt={listing.cover_photo?.alt_text || `${listing.name} cover photo`}
                className="mapa-user-page__listing-cover"
                decoding="async"
                loading="lazy"
                src={cover}
              />
            )}
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
        <button
          className={`mapa-user-page__save-button${isSaved ? " is-saved" : ""}`}
          disabled={savingListingId === listing.id}
          onClick={() => void toggleSavedListing(listing.id)}
          type="button"
        >
          {isSaved ? "Saved" : "Save"}
        </button>
      </article>
    );
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
          <button className="mapa-user-page__brand mapa-user-page__brand--button" onClick={handleLogoClick} type="button">
            <div className="mapa-user-page__brand-icon">
              <HouseMark className="mapa-user-page__house-icon" />
            </div>
            <div>
              <p className="mapa-user-page__brand-wordmark">MAPAGUAPA</p>
            </div>
          </button>

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
              <button className="mapa-user-page__account-menu-link" onClick={() => navigateUserView("saved")} role="menuitem" type="button">
                Saved Listings
              </button>
              <button className="mapa-user-page__account-menu-link" onClick={onNavigateAbout} role="menuitem" type="button">
                About MaPaGuaPa
              </button>
            </div>
          </div>
        </header>

        <nav className="mapa-user-page__view-nav" aria-label="Student pages">
          <button className={view === "listings" ? "is-active" : ""} onClick={() => navigateUserView("listings")} type="button">
            Listings
          </button>
          <button className={view === "saved" ? "is-active" : ""} onClick={() => navigateUserView("saved")} type="button">
            Saved Listings
          </button>
        </nav>

        {view === "listings" && <section className="mapa-user-page__filters-panel">
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
                  <span className="mapa-user-page__filters-meta">Monthly</span>
                </div>
                <div className="mapa-user-page__budget-fields">
                  <label className="mapa-user-page__budget-field">
                    <span>Minimum Budget</span>
                    <input
                      inputMode="numeric"
                      min="0"
                      onChange={(event) => setMinBudget(event.target.value)}
                      placeholder="₱0"
                      type="number"
                      value={minBudget}
                    />
                  </label>
                  <label className="mapa-user-page__budget-field">
                    <span>Maximum Budget</span>
                    <input
                      inputMode="numeric"
                      min="0"
                      onChange={(event) => setMaxBudget(event.target.value)}
                      placeholder="₱5000"
                      type="number"
                      value={maxBudget}
                    />
                  </label>
                </div>
                <div className="mapa-user-page__budget-footer">
                  <span className={`mapa-user-page__budget-message${hasInvalidBudgetRange ? " is-error" : ""}`}>
                    {hasInvalidBudgetRange
                      ? "Minimum budget must be lower than maximum budget."
                      : hasBudgetFilter
                        ? `Showing ${minBudget ? `₱${minBudget}` : "₱0"} to ${maxBudget ? `₱${maxBudget}` : "any price"}`
                        : "Leave both fields empty to include every budget."}
                  </span>
                  {hasBudgetFilter && (
                    <button
                      className="mapa-user-page__budget-clear"
                      onClick={clearBudgetFilter}
                      type="button"
                    >
                      Clear budget
                    </button>
                  )}
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
        </section>}

        {saveFeedback && <p className="mapa-user-page__feedback mapa-user-page__feedback--error">{saveFeedback}</p>}
        {detailLoading && <p className="mapa-user-page__feedback">Loading listing details...</p>}
        {detailError && <p className="mapa-user-page__feedback mapa-user-page__feedback--error">{detailError}</p>}
        {loading && <p className="mapa-user-page__feedback">Loading listings from Supabase...</p>}
        {error && <p className="mapa-user-page__feedback mapa-user-page__feedback--error">{error}</p>}

        {!loading && !error && view === "listings" && listings.length === 0 && hasAnyListingFilter && (
          <article className="mapa-user-page__empty-state">
            <p className="mapa-user-page__eyebrow">No matching stays</p>
            <h3>Try another search or switch filters.</h3>
            <p>Once the filters loosen up, the available properties will appear here again.</p>
          </article>
        )}

        {!loading && !error && view === "listings" && listings.length === 0 && !hasAnyListingFilter && (
          <p className="mapa-user-page__feedback">No active listings are available yet.</p>
        )}

        {!loading && !error && view === "listings" && listings.length > 0 && visibleSections.length === 0 && (
          <article className="mapa-user-page__empty-state">
            <p className="mapa-user-page__eyebrow">No matching stays</p>
            <h3>Try another search or switch filters.</h3>
            <p>Once the filters loosen up, the available properties will appear here again.</p>
          </article>
        )}

        {!loading && !error && view === "saved" && savedListings.length === 0 && (
          <article className="mapa-user-page__empty-state">
            <p className="mapa-user-page__eyebrow">Saved listings</p>
            <h3>You haven't saved any places yet.</h3>
            <p>Tap Save on a listing to keep it here for later.</p>
          </article>
        )}

        {!loading && !error && view === "saved" && savedListings.length > 0 && (
          <section className="mapa-user-page__listing-section">
            <div className="mapa-user-page__section-head">
              <div>
                <p className="mapa-user-page__eyebrow">Saved Listings</p>
                <h2 className="mapa-user-page__section-title">Places you saved for later</h2>
              </div>
              <div className="mapa-user-page__section-status" aria-label={`${savedListings.length} saved listings`}>
                <span className="mapa-user-page__section-status-dot" />
                <strong>{savedListings.length.toString().padStart(2, "0")}</strong>
                <span>{savedListings.length === 1 ? "saved listing" : "saved listings"}</span>
              </div>
            </div>
            <div className="mapa-user-page__listing-grid">{savedListings.map(renderListingCard)}</div>
          </section>
        )}

        {!loading && !error && view === "listings" && visibleSections.length > 0 && (
          <div className="mapa-user-page__sections">
            {visibleSections.map((section) => (
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
                  {section.items.map(renderListingCard)}
                </div>
                {areaHasMore[section.area] && (
                  <div className="mapa-user-page__load-more-wrap">
                    <button
                      className="mapa-user-page__load-more"
                      disabled={Boolean(areaLoading[section.area])}
                      onClick={() => loadMoreListings(section.area)}
                      type="button"
                    >
                      {areaLoading[section.area] ? "Loading more..." : `Load More in ${section.area}`}
                    </button>
                  </div>
                )}
              </section>
            ))}
          </div>
        )}

        <footer className="mapa-user-page__footer">
          <button className="mapa-user-page__about-link" onClick={onNavigateAbout} type="button">
            About MaPaGuaPa
          </button>
          <p className="mapa-user-page__powered-by">
            <span>Powered by</span>
            <a href="https://boyles-christian-portfolio.vercel.app/" rel="noreferrer" target="_blank">
              Lily Tech Solutions Co.
            </a>
          </p>
        </footer>
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
                <button className="mapa-user-page__modal-close" onClick={() => void toggleSavedListing(openListing.id)} type="button">
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
                  decoding="async"
                  loading="lazy"
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
