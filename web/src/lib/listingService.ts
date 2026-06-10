import { supabase } from "./supabase";
import type { Database } from "./database";
import type { DeletedListingRow, ListingCardSummary, ListingPhotoRow, ListingRow, ListingWithPhotos } from "./models";

export const listingSelect = `
  id,
  name,
  address,
  accommodation_type,
  accommodation_type_other,
  description,
  is_fenced,
  floors_label,
  floor_count,
  rooms_available,
  exclusivity,
  occupancy_label,
  occupancy_min,
  occupancy_max,
  monthly_rental_label,
  monthly_rent_min,
  monthly_rent_max,
  utilities_included,
  bills_included,
  bills_not_included,
  has_additional_appliance_fee,
  appliance_fee_label,
  appliance_fee_amount,
  has_laundry_area,
  has_drying_area,
  has_comfort_room_each_room,
  comfort_rooms_separate_from_bathrooms,
  comfort_room_count,
  bathroom_count,
  has_bathroom_each_floor,
  has_charging_slots_each_room,
  charging_station_count_label,
  charging_station_count,
  has_electric_fans,
  has_aircon,
  aircon_room_count,
  has_common_kitchen,
  has_refrigerator,
  has_television,
  other_amenities,
  has_study_area,
  has_wifi,
  cellular_signals_raw,
  cellular_signals,
  has_parking_area,
  pets_allowed,
  curfew,
  visitors_allowed,
  visitor_time,
  smoking_allowed,
  has_security_cctv,
  has_emergency_exit,
  has_fire_alarm,
  has_emergency_lights,
  has_fire_extinguisher,
  has_smoke_detector,
  has_sprinkler,
  contact_person,
  contact_number,
  other_contact_information,
  location_lat,
  location_lng,
  raw_import_data,
  source_row_number,
  status,
  created_by,
  updated_by,
  deleted_by,
  created_at,
  updated_at,
  deleted_at,
  listing_photos (
    id,
    listing_id,
    storage_bucket,
    storage_path,
    caption,
    alt_text,
    sort_order,
    is_cover,
    uploaded_by,
    created_at,
    updated_at
  )
`;

const listingCardSelect = `
  id,
  name,
  address,
  accommodation_type,
  exclusivity,
  monthly_rental_label,
  monthly_rent_min,
  monthly_rent_max,
  rooms_available,
  has_wifi,
  has_study_area,
  has_laundry_area,
  has_parking_area,
  pets_allowed,
  visitors_allowed,
  created_at
`;

const listingPhotoSelect = `
  id,
  listing_id,
  storage_bucket,
  storage_path,
  caption,
  alt_text,
  sort_order,
  is_cover,
  uploaded_by,
  created_at,
  updated_at
`;

export type ListingFilters = {
  search?: string;
  area?: string;
  accommodationType?: string;
  minBudget?: number | null;
  maxBudget?: number | null;
  exclusivity?: string;
  features?: Array<"wifi" | "study" | "laundry" | "parking" | "pets" | "visitors">;
};

export type PaginatedListingsResult = {
  listings: ListingCardSummary[];
  hasMore: boolean;
};

export type ListingFilterOptions = {
  areas: string[];
  accommodationTypes: string[];
  exclusivities: string[];
};

export type ListingDraft = {
  name: string;
  address: string;
  accommodationType: string;
  accommodationTypeOther: string;
  exclusivity: string;
  monthlyRentalLabel: string;
  roomsAvailable: string;
  floorsLabel: string;
  occupancyLabel: string;
  curfew: string;
  noCurfew: boolean;
  billsIncluded: string;
  billsNotIncluded: string;
  description: string;
  contactPerson: string;
  contactNumber: string;
  otherContactInformation: string;
  cellularSignalsRaw: string;
  utilitiesIncluded: boolean;
  applianceFee: boolean;
  applianceAmount: string;
  fenced: boolean;
  comfortRoomPerRoom: boolean;
  separateCrBath: boolean;
  comfortRooms: string;
  bathrooms: string;
  crBathPerFloor: boolean;
  chargingSlots: boolean;
  chargingStations: string;
  electricFans: boolean;
  aircon: boolean;
  airconRooms: string;
  wifi: boolean;
  studyArea: boolean;
  parkingArea: boolean;
  commonKitchen: boolean;
  refrigerator: boolean;
  television: boolean;
  otherAmenities: string;
  petsAllowed: boolean;
  visitorsAllowed: boolean;
  visitorTime: string;
  smokingAllowed: boolean;
  security: boolean;
  emergencyExit: boolean;
  fireAlarm: boolean;
  emergencyLights: boolean;
  fireExtinguisher: boolean;
  smokeDetector: boolean;
  sprinkler: boolean;
  laundryArea: boolean;
  dryingArea: boolean;
  locationLat: string;
  locationLng: string;
};

export const emptyListingDraft: ListingDraft = {
  name: "",
  address: "",
  accommodationType: "Boarding House",
  accommodationTypeOther: "",
  exclusivity: "Co-ed (Mixed)",
  monthlyRentalLabel: "1000-1999",
  roomsAvailable: "1",
  floorsLabel: "1 only",
  occupancyLabel: "1-4",
  curfew: "No curfew",
  noCurfew: true,
  billsIncluded: "",
  billsNotIncluded: "",
  description: "",
  contactPerson: "",
  contactNumber: "",
  otherContactInformation: "",
  cellularSignalsRaw: "",
  utilitiesIncluded: false,
  applianceFee: false,
  applianceAmount: "",
  fenced: false,
  comfortRoomPerRoom: false,
  separateCrBath: false,
  comfortRooms: "",
  bathrooms: "",
  crBathPerFloor: false,
  chargingSlots: false,
  chargingStations: "",
  electricFans: false,
  aircon: false,
  airconRooms: "",
  wifi: false,
  studyArea: false,
  parkingArea: false,
  commonKitchen: false,
  refrigerator: false,
  television: false,
  otherAmenities: "",
  petsAllowed: false,
  visitorsAllowed: false,
  visitorTime: "",
  smokingAllowed: false,
  security: false,
  emergencyExit: false,
  fireAlarm: false,
  emergencyLights: false,
  fireExtinguisher: false,
  smokeDetector: false,
  sprinkler: false,
  laundryArea: false,
  dryingArea: false,
  locationLat: "",
  locationLng: "",
};

export function parseSignalsInput(raw: string) {
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function listingToDraft(listing: ListingRow | null | undefined): ListingDraft {
  if (!listing) {
    return { ...emptyListingDraft };
  }

  return {
    name: listing.name,
    address: listing.address,
    accommodationType: listing.accommodation_type,
    accommodationTypeOther: listing.accommodation_type_other ?? "",
    exclusivity: listing.exclusivity ?? "",
    monthlyRentalLabel: listing.monthly_rental_label,
    roomsAvailable: String(listing.rooms_available ?? ""),
    floorsLabel: listing.floors_label ?? "",
    occupancyLabel: listing.occupancy_label ?? "",
    curfew: listing.curfew ?? "",
    noCurfew: (listing.curfew ?? "").toLowerCase() === "no curfew",
    billsIncluded: listing.bills_included ?? "",
    billsNotIncluded: listing.bills_not_included ?? "",
    description: listing.description ?? "",
    contactPerson: listing.contact_person ?? "",
    contactNumber: listing.contact_number ?? "",
    otherContactInformation: listing.other_contact_information ?? "",
    cellularSignalsRaw: listing.cellular_signals_raw ?? listing.cellular_signals.join(", "),
    utilitiesIncluded: Boolean(listing.utilities_included),
    applianceFee: Boolean(listing.has_additional_appliance_fee),
    applianceAmount: listing.appliance_fee_label ?? (listing.appliance_fee_amount == null ? "" : String(listing.appliance_fee_amount)),
    fenced: Boolean(listing.is_fenced),
    comfortRoomPerRoom: Boolean(listing.has_comfort_room_each_room),
    separateCrBath: Boolean(listing.comfort_rooms_separate_from_bathrooms),
    comfortRooms: listing.comfort_room_count == null ? "" : String(listing.comfort_room_count),
    bathrooms: listing.bathroom_count == null ? "" : String(listing.bathroom_count),
    crBathPerFloor: Boolean(listing.has_bathroom_each_floor),
    chargingSlots: Boolean(listing.has_charging_slots_each_room),
    chargingStations: listing.charging_station_count_label ?? (listing.charging_station_count == null ? "" : String(listing.charging_station_count)),
    electricFans: Boolean(listing.has_electric_fans),
    aircon: Boolean(listing.has_aircon),
    airconRooms: listing.aircon_room_count == null ? "" : String(listing.aircon_room_count),
    wifi: Boolean(listing.has_wifi),
    studyArea: Boolean(listing.has_study_area),
    parkingArea: Boolean(listing.has_parking_area),
    commonKitchen: Boolean(listing.has_common_kitchen),
    refrigerator: Boolean(listing.has_refrigerator),
    television: Boolean(listing.has_television),
    otherAmenities: listing.other_amenities ?? "",
    petsAllowed: Boolean(listing.pets_allowed),
    visitorsAllowed: Boolean(listing.visitors_allowed),
    visitorTime: listing.visitor_time ?? "",
    smokingAllowed: Boolean(listing.smoking_allowed),
    security: Boolean(listing.has_security_cctv),
    emergencyExit: Boolean(listing.has_emergency_exit),
    fireAlarm: Boolean(listing.has_fire_alarm),
    emergencyLights: Boolean(listing.has_emergency_lights),
    fireExtinguisher: Boolean(listing.has_fire_extinguisher),
    smokeDetector: Boolean(listing.has_smoke_detector),
    sprinkler: Boolean(listing.has_sprinkler),
    laundryArea: Boolean(listing.has_laundry_area),
    dryingArea: Boolean(listing.has_drying_area),
    locationLat: listing.location_lat == null ? "" : String(listing.location_lat),
    locationLng: listing.location_lng == null ? "" : String(listing.location_lng),
  };
}

export function draftToListingPayload(draft: ListingDraft): Database["public"]["Tables"]["listings"]["Insert"] {
  const rooms = Number.parseInt(draft.roomsAvailable, 10);
  const applianceAmount = Number.parseFloat(draft.applianceAmount);
  const comfortRooms = Number.parseInt(draft.comfortRooms, 10);
  const bathrooms = Number.parseInt(draft.bathrooms, 10);
  const chargingStations = Number.parseInt(draft.chargingStations, 10);
  const airconRooms = Number.parseInt(draft.airconRooms, 10);
  const latitude = Number.parseFloat(draft.locationLat);
  const longitude = Number.parseFloat(draft.locationLng);

  return {
    name: draft.name.trim(),
    address: draft.address.trim(),
    accommodation_type: draft.accommodationType.trim(),
    accommodation_type_other: draft.accommodationType === "Others" ? draft.accommodationTypeOther.trim() || null : null,
    exclusivity: draft.exclusivity.trim() || null,
    monthly_rental_label: draft.monthlyRentalLabel.trim(),
    rooms_available: Number.isNaN(rooms) ? null : rooms,
    floors_label: draft.floorsLabel.trim() || null,
    occupancy_label: draft.occupancyLabel.trim() || null,
    curfew: draft.noCurfew ? "No curfew" : "With curfew",
    bills_included: draft.billsIncluded.trim() || null,
    bills_not_included: draft.billsNotIncluded.trim() || null,
    description: draft.description.trim() || null,
    contact_person: draft.contactPerson.trim() || null,
    contact_number: draft.contactNumber.trim() || null,
    other_contact_information: draft.otherContactInformation.trim() || null,
    cellular_signals_raw: draft.cellularSignalsRaw.trim() || null,
    cellular_signals: parseSignalsInput(draft.cellularSignalsRaw),
    utilities_included: Boolean(draft.billsIncluded.trim()),
    has_additional_appliance_fee: draft.applianceFee,
    appliance_fee_label: draft.applianceFee ? draft.applianceAmount.trim() || null : null,
    appliance_fee_amount: draft.applianceFee && Number.isFinite(applianceAmount) ? applianceAmount : null,
    is_fenced: draft.fenced,
    has_comfort_room_each_room: draft.comfortRoomPerRoom,
    comfort_rooms_separate_from_bathrooms: draft.separateCrBath,
    comfort_room_count: Number.isNaN(comfortRooms) ? null : comfortRooms,
    bathroom_count: Number.isNaN(bathrooms) ? null : bathrooms,
    has_bathroom_each_floor: draft.crBathPerFloor,
    has_charging_slots_each_room: draft.chargingSlots,
    charging_station_count_label: draft.chargingStations.trim() || null,
    charging_station_count: Number.isNaN(chargingStations) ? null : chargingStations,
    has_electric_fans: draft.electricFans,
    has_aircon: draft.aircon,
    aircon_room_count: Number.isNaN(airconRooms) ? null : airconRooms,
    has_wifi: draft.wifi,
    has_study_area: draft.studyArea,
    has_parking_area: draft.parkingArea,
    has_common_kitchen: draft.commonKitchen,
    has_refrigerator: draft.refrigerator,
    has_television: draft.television,
    other_amenities: draft.otherAmenities.trim() || null,
    pets_allowed: draft.petsAllowed,
    visitors_allowed: draft.visitorsAllowed,
    visitor_time: null,
    smoking_allowed: draft.smokingAllowed,
    has_security_cctv: draft.security,
    has_emergency_exit: draft.emergencyExit,
    has_fire_alarm: draft.fireAlarm,
    has_emergency_lights: draft.emergencyLights,
    has_fire_extinguisher: draft.fireExtinguisher,
    has_smoke_detector: draft.smokeDetector,
    has_sprinkler: draft.sprinkler,
    has_laundry_area: draft.laundryArea,
    has_drying_area: draft.dryingArea,
    location_lat: Number.isFinite(latitude) ? latitude : null,
    location_lng: Number.isFinite(longitude) ? longitude : null,
  };
}

export async function fetchActiveListings() {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { data, error } = await supabase
    .from("listings")
    .select(listingSelect)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as ListingWithPhotos[];
}

function applyListingFilters(query: any, filters: ListingFilters) {
  let nextQuery = query.eq("status", "active");
  const search = filters.search?.trim();

  if (search) {
    const escapedSearch = search.replace(/[%_]/g, "\\$&");
    nextQuery = nextQuery.or(
      `name.ilike.%${escapedSearch}%,address.ilike.%${escapedSearch}%,accommodation_type.ilike.%${escapedSearch}%,exclusivity.ilike.%${escapedSearch}%`
    );
  }

  if (filters.area?.trim()) {
    nextQuery = nextQuery.ilike("address", `%${filters.area.trim()}%`);
  }

  if (filters.accommodationType?.trim()) {
    nextQuery = nextQuery.eq("accommodation_type", filters.accommodationType.trim());
  }

  if (filters.exclusivity?.trim()) {
    nextQuery = nextQuery.eq("exclusivity", filters.exclusivity.trim());
  }

  if (typeof filters.minBudget === "number" && typeof filters.maxBudget === "number") {
    nextQuery = nextQuery.gte("monthly_rent_min", filters.minBudget).lte("monthly_rent_max", filters.maxBudget);
  } else if (typeof filters.minBudget === "number") {
    nextQuery = nextQuery.or(`monthly_rent_max.gte.${filters.minBudget},monthly_rent_max.is.null`);
  } else if (typeof filters.maxBudget === "number") {
    nextQuery = nextQuery.or(`monthly_rent_min.lte.${filters.maxBudget},monthly_rent_min.is.null`);
  }

  filters.features?.forEach((feature) => {
    const columnByFeature = {
      wifi: "has_wifi",
      study: "has_study_area",
      laundry: "has_laundry_area",
      parking: "has_parking_area",
      pets: "pets_allowed",
      visitors: "visitors_allowed",
    } as const;

    nextQuery = nextQuery.eq(columnByFeature[feature], true);
  });

  return nextQuery;
}

function getAreaLabelFromAddress(address: string | null | undefined) {
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

export async function fetchListingFilterOptions(): Promise<ListingFilterOptions> {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { data, error } = await supabase
    .from("listings")
    .select("address, accommodation_type, exclusivity")
    .eq("status", "active");

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as Array<{
    address: string | null;
    accommodation_type: string | null;
    exclusivity: string | null;
  }>;

  return {
    areas: Array.from(new Set(rows.map((row) => getAreaLabelFromAddress(row.address)).filter(Boolean))).sort(),
    accommodationTypes: Array.from(new Set(rows.map((row) => row.accommodation_type).filter((value): value is string => Boolean(value)))).sort(),
    exclusivities: Array.from(new Set(rows.map((row) => row.exclusivity).filter((value): value is string => Boolean(value)))).sort(),
  };
}

function chooseCoverPhotos(photos: ListingPhotoRow[]) {
  const coverByListingId = new Map<string, ListingPhotoRow>();

  photos.forEach((photo) => {
    const current = coverByListingId.get(photo.listing_id);
    if (!current) {
      coverByListingId.set(photo.listing_id, photo);
      return;
    }

    if (photo.is_cover && !current.is_cover) {
      coverByListingId.set(photo.listing_id, photo);
      return;
    }

    if (photo.is_cover === current.is_cover && photo.sort_order < current.sort_order) {
      coverByListingId.set(photo.listing_id, photo);
    }
  });

  return coverByListingId;
}

async function attachCoverPhotos(listings: ListingCardSummary[]) {
  if (!supabase || listings.length === 0) {
    return listings;
  }

  const listingIds = listings.map((listing) => listing.id);
  const { data, error } = await supabase
    .from("listing_photos")
    .select(listingPhotoSelect)
    .in("listing_id", listingIds)
    .order("is_cover", { ascending: false })
    .order("sort_order", { ascending: true });

  if (error) {
    throw error;
  }

  const coverByListingId = chooseCoverPhotos((data ?? []) as ListingPhotoRow[]);
  return listings.map((listing) => ({
    ...listing,
    cover_photo: coverByListingId.get(listing.id) ?? null,
  }));
}

export async function fetchListingCards({
  page,
  pageSize,
  filters = {},
}: {
  page: number;
  pageSize: number;
  filters?: ListingFilters;
}): Promise<PaginatedListingsResult> {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const from = page * pageSize;
  // Supabase ranges are inclusive, so this fetches one extra row to detect whether another page exists.
  const to = from + pageSize;
  const query = applyListingFilters(supabase.from("listings").select(listingCardSelect), filters)
    .order("created_at", { ascending: false })
    .range(from, to);

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as ListingCardSummary[];
  const pageRows = rows.slice(0, pageSize);
  const withCoverPhotos = await attachCoverPhotos(pageRows);

  return {
    listings: withCoverPhotos,
    hasMore: rows.length > pageSize,
  };
}

export async function fetchListingDetail(listingId: string) {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { data, error } = await supabase
    .from("listings")
    .select(listingSelect)
    .eq("id", listingId)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as ListingWithPhotos | null;
}

export async function fetchAdminListings() {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { data, error } = await supabase
    .from("listings")
    .select(listingSelect)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as ListingWithPhotos[];
}

export async function fetchDeletedListings() {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { data, error } = await supabase
    .from("deleted_listings")
    .select("id, original_listing_id, listing_name, deleted_by, delete_reason, listing_snapshot, deleted_at")
    .order("deleted_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as DeletedListingRow[];
}

export async function fetchSavedListingIds(userId: string) {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { data, error } = await (supabase.from("saved_listings") as any)
    .select("accommodation_id")
    .eq("user_id", userId);

  if (error) {
    throw error;
  }

  return ((data ?? []) as Array<{ accommodation_id: string }>).map((item) => item.accommodation_id);
}

export async function fetchSavedListingCards(userId: string) {
  const savedIds = await fetchSavedListingIds(userId);
  if (!supabase || savedIds.length === 0) {
    return { ids: savedIds, listings: [] as ListingCardSummary[] };
  }

  const { data, error } = await supabase
    .from("listings")
    .select(listingCardSelect)
    .eq("status", "active")
    .in("id", savedIds);

  if (error) {
    throw error;
  }

  const order = new Map(savedIds.map((id, index) => [id, index]));
  const rows = ((data ?? []) as ListingCardSummary[]).sort(
    (left, right) => (order.get(left.id) ?? 0) - (order.get(right.id) ?? 0)
  );

  return {
    ids: savedIds,
    listings: await attachCoverPhotos(rows),
  };
}

export async function saveListingForUser(userId: string, listingId: string) {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { error } = await (supabase.from("saved_listings") as any)
    .upsert(
      { user_id: userId, accommodation_id: listingId },
      { onConflict: "user_id,accommodation_id", ignoreDuplicates: true }
    );

  if (error) {
    throw error;
  }
}

export async function unsaveListingForUser(userId: string, listingId: string) {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { error } = await (supabase.from("saved_listings") as any)
    .delete()
    .eq("user_id", userId)
    .eq("accommodation_id", listingId);

  if (error) {
    throw error;
  }
}
