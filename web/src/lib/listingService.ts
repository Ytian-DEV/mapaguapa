import { supabase } from "./supabase";
import type { Database } from "./database";
import type { DeletedListingRow, ListingRow, ListingWithPhotos } from "./models";

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
  has_study_area,
  has_wifi,
  cellular_signals_raw,
  cellular_signals,
  has_parking_area,
  pets_allowed,
  curfew,
  visitors_allowed,
  has_security_cctv,
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

export type ListingDraft = {
  name: string;
  address: string;
  accommodationType: string;
  exclusivity: string;
  monthlyRentalLabel: string;
  roomsAvailable: string;
  floorsLabel: string;
  occupancyLabel: string;
  curfew: string;
  billsNotIncluded: string;
  description: string;
  contactPerson: string;
  contactNumber: string;
  otherContactInformation: string;
  cellularSignalsRaw: string;
  utilitiesIncluded: boolean;
  wifi: boolean;
  studyArea: boolean;
  parkingArea: boolean;
  petsAllowed: boolean;
  security: boolean;
  laundryArea: boolean;
  dryingArea: boolean;
  locationLat: string;
  locationLng: string;
};

export const emptyListingDraft: ListingDraft = {
  name: "",
  address: "",
  accommodationType: "Boarding House",
  exclusivity: "Co-ed (Mixed)",
  monthlyRentalLabel: "1000-1999",
  roomsAvailable: "1",
  floorsLabel: "1 only",
  occupancyLabel: "1-4",
  curfew: "No curfew",
  billsNotIncluded: "",
  description: "",
  contactPerson: "",
  contactNumber: "",
  otherContactInformation: "",
  cellularSignalsRaw: "",
  utilitiesIncluded: false,
  wifi: false,
  studyArea: false,
  parkingArea: false,
  petsAllowed: false,
  security: false,
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
    exclusivity: listing.exclusivity ?? "",
    monthlyRentalLabel: listing.monthly_rental_label,
    roomsAvailable: String(listing.rooms_available ?? ""),
    floorsLabel: listing.floors_label ?? "",
    occupancyLabel: listing.occupancy_label ?? "",
    curfew: listing.curfew ?? "",
    billsNotIncluded: listing.bills_not_included ?? "",
    description: listing.description ?? "",
    contactPerson: listing.contact_person ?? "",
    contactNumber: listing.contact_number ?? "",
    otherContactInformation: listing.other_contact_information ?? "",
    cellularSignalsRaw: listing.cellular_signals_raw ?? listing.cellular_signals.join(", "),
    utilitiesIncluded: Boolean(listing.utilities_included),
    wifi: Boolean(listing.has_wifi),
    studyArea: Boolean(listing.has_study_area),
    parkingArea: Boolean(listing.has_parking_area),
    petsAllowed: Boolean(listing.pets_allowed),
    security: Boolean(listing.has_security_cctv),
    laundryArea: Boolean(listing.has_laundry_area),
    dryingArea: Boolean(listing.has_drying_area),
    locationLat: listing.location_lat == null ? "" : String(listing.location_lat),
    locationLng: listing.location_lng == null ? "" : String(listing.location_lng),
  };
}

export function draftToListingPayload(draft: ListingDraft): Database["public"]["Tables"]["listings"]["Insert"] {
  const rooms = Number.parseInt(draft.roomsAvailable, 10);
  const latitude = Number.parseFloat(draft.locationLat);
  const longitude = Number.parseFloat(draft.locationLng);

  return {
    name: draft.name.trim(),
    address: draft.address.trim(),
    accommodation_type: draft.accommodationType.trim(),
    exclusivity: draft.exclusivity.trim() || null,
    monthly_rental_label: draft.monthlyRentalLabel.trim(),
    rooms_available: Number.isNaN(rooms) ? null : rooms,
    floors_label: draft.floorsLabel.trim() || null,
    occupancy_label: draft.occupancyLabel.trim() || null,
    curfew: draft.curfew.trim() || null,
    bills_not_included: draft.billsNotIncluded.trim() || null,
    description: draft.description.trim() || null,
    contact_person: draft.contactPerson.trim() || null,
    contact_number: draft.contactNumber.trim() || null,
    other_contact_information: draft.otherContactInformation.trim() || null,
    cellular_signals_raw: draft.cellularSignalsRaw.trim() || null,
    cellular_signals: parseSignalsInput(draft.cellularSignalsRaw),
    utilities_included: draft.utilitiesIncluded,
    has_wifi: draft.wifi,
    has_study_area: draft.studyArea,
    has_parking_area: draft.parkingArea,
    pets_allowed: draft.petsAllowed,
    has_security_cctv: draft.security,
    has_laundry_area: draft.laundryArea,
    has_drying_area: draft.dryingArea,
    location_lat: Number.isFinite(latitude) ? latitude : null,
    location_lng: Number.isFinite(longitude) ? longitude : null,
    status: "active",
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

export async function fetchAdminListings() {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { data, error } = await supabase
    .from("listings")
    .select(listingSelect)
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
