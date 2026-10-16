import type { Tables, TablesUpdate } from "../../lib/database";
import { isValidLatLng } from "../../lib/geo";
import type { WizardStepKey } from "./steps";

/** The listing columns the wizard edits. Values match what v1 stored, so old and new data mix. */
export const WIZARD_FIELDS = [
  "name",
  "accommodation_type",
  "accommodation_type_other",
  "address",
  "description",
  "floor_count",
  "is_fenced",
  "contact_person",
  "contact_number",
  "other_contact_information",
  "exclusivity",
  "rent_exact",
  "advance_deposit",
  "rooms_total",
  "rooms_available",
  "occupancy_min",
  "occupancy_max",
  "room_types",
  "bills_included",
  "bills_not_included",
  "utilities_included",
  "has_additional_appliance_fee",
  "appliance_fee_amount",
  "appliance_fee_label",
  "cellular_signals",
  "has_wifi",
  "has_study_area",
  "has_common_kitchen",
  "has_laundry_area",
  "has_drying_area",
  "has_parking_area",
  "has_comfort_room_each_room",
  "comfort_room_count",
  "has_bathroom_each_floor",
  "bathroom_count",
  "has_charging_slots_each_room",
  "has_electric_fans",
  "has_aircon",
  "aircon_room_count",
  "has_refrigerator",
  "has_television",
  "other_amenities",
  "curfew",
  "visitors_allowed",
  "visitor_time",
  "pets_allowed",
  "smoking_allowed",
  "has_security_cctv",
  "has_fire_alarm",
  "has_smoke_detector",
  "has_fire_extinguisher",
  "has_sprinkler",
  "has_emergency_exit",
  "has_emergency_lights",
  "location_lat",
  "location_lng",
] as const;

export type WizardField = (typeof WIZARD_FIELDS)[number];
export type WizardListing = Tables<"listings">;
export type WizardForm = Pick<WizardListing, WizardField>;

export type RoomType = { label: string; capacity: number | null; rent: number | null; available: number | null };

export const ACCOMMODATION_TYPES = ["Boarding House", "Dormitory", "Apartment", "Bedspace", "Others"];
export const EXCLUSIVITY_VALUES = [
  { value: "Female", label: "Ladies only", description: "Female tenants only" },
  { value: "Male", label: "Men only", description: "Male tenants only" },
  { value: "Mixed", label: "Mixed", description: "Ladies and men" },
] as const;
export const ADVANCE_DEPOSIT_OPTIONS = [
  "No advance or deposit",
  "1 month advance",
  "1 month deposit",
  "1 month advance + 1 month deposit",
  "2 months advance + 1 month deposit",
];
export const BILL_ITEMS = ["Electricity", "Water", "Internet", "LPG / gas"];
export const SIGNAL_OPTIONS = ["Smart/TnT", "Globe/TM", "DITO"];

export const EMPTY_FORM: WizardForm = {
  name: "",
  accommodation_type: "Boarding House",
  accommodation_type_other: null,
  address: "",
  description: null,
  floor_count: null,
  is_fenced: null,
  contact_person: null,
  contact_number: null,
  other_contact_information: null,
  exclusivity: null,
  rent_exact: null,
  advance_deposit: null,
  rooms_total: null,
  rooms_available: null,
  occupancy_min: null,
  occupancy_max: null,
  room_types: [],
  bills_included: null,
  bills_not_included: null,
  utilities_included: null,
  has_additional_appliance_fee: null,
  appliance_fee_amount: null,
  appliance_fee_label: null,
  cellular_signals: [],
  has_wifi: null,
  has_study_area: null,
  has_common_kitchen: null,
  has_laundry_area: null,
  has_drying_area: null,
  has_parking_area: null,
  has_comfort_room_each_room: null,
  comfort_room_count: null,
  has_bathroom_each_floor: null,
  bathroom_count: null,
  has_charging_slots_each_room: null,
  has_electric_fans: null,
  has_aircon: null,
  aircon_room_count: null,
  has_refrigerator: null,
  has_television: null,
  other_amenities: null,
  curfew: null,
  visitors_allowed: null,
  visitor_time: null,
  pets_allowed: null,
  smoking_allowed: null,
  has_security_cctv: null,
  has_fire_alarm: null,
  has_smoke_detector: null,
  has_fire_extinguisher: null,
  has_sprinkler: null,
  has_emergency_exit: null,
  has_emergency_lights: null,
  location_lat: null,
  location_lng: null,
};

export function formFromListing(listing: WizardListing): WizardForm {
  const form = { ...EMPTY_FORM };
  WIZARD_FIELDS.forEach((field) => {
    (form as Record<string, unknown>)[field] = listing[field] ?? EMPTY_FORM[field];
  });
  return form;
}

function same(a: unknown, b: unknown) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/** Only the fields that changed since the last save. */
export function diffForm(saved: WizardForm, current: WizardForm): TablesUpdate<"listings"> {
  const patch: Record<string, unknown> = {};
  WIZARD_FIELDS.forEach((field) => {
    if (!same(saved[field], current[field])) patch[field] = current[field];
  });
  return patch as TablesUpdate<"listings">;
}

export function roomTypes(form: WizardForm): RoomType[] {
  return Array.isArray(form.room_types) ? (form.room_types as unknown as RoomType[]) : [];
}

/** Comma list <-> checked items for bills and signals. */
export function splitList(value: string | null | undefined) {
  return (value ?? "")
    .split(/[,;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Completeness (live preview bar + review step)
// ---------------------------------------------------------------------------
export type Check = { key: string; label: string; step: WizardStepKey; done: boolean; required: boolean };

const AMENITY_FLAGS: WizardField[] = [
  "has_wifi",
  "has_study_area",
  "has_common_kitchen",
  "has_laundry_area",
  "has_parking_area",
  "has_comfort_room_each_room",
  "has_electric_fans",
  "has_aircon",
];
const SAFETY_FLAGS: WizardField[] = [
  "has_security_cctv",
  "has_fire_alarm",
  "has_smoke_detector",
  "has_fire_extinguisher",
  "has_sprinkler",
  "has_emergency_exit",
  "has_emergency_lights",
];

export const MIN_PHOTOS = 3;

export function checks(form: WizardForm, photoCount: number): Check[] {
  const hasText = (value: string | null | undefined, min = 1) => (value ?? "").trim().length >= min;
  return [
    { key: "name", label: "Listing name", step: "basics", done: hasText(form.name, 3), required: true },
    { key: "address", label: "Address with barangay", step: "basics", done: hasText(form.address, 5), required: true },
    { key: "contact", label: "Contact number", step: "basics", done: hasText(form.contact_number, 7), required: true },
    { key: "description", label: "Short description", step: "basics", done: hasText(form.description, 40), required: false },
    { key: "exclusivity", label: "Who can stay", step: "rooms", done: hasText(form.exclusivity), required: true },
    { key: "rent", label: "Monthly rent", step: "rooms", done: form.rent_exact !== null && Number(form.rent_exact) > 0, required: true },
    { key: "rooms", label: "Rooms and availability", step: "rooms", done: Boolean(form.rooms_total) && form.rooms_available !== null, required: true },
    { key: "bills", label: "What the rent includes", step: "bills", done: hasText(form.bills_included) || hasText(form.bills_not_included), required: false },
    { key: "amenities", label: "At least one amenity", step: "comfort", done: AMENITY_FLAGS.some((field) => form[field] === true), required: false },
    { key: "rules", label: "House rules", step: "rules", done: form.visitors_allowed !== null || hasText(form.curfew), required: false },
    { key: "safety", label: "Safety features", step: "rules", done: SAFETY_FLAGS.some((field) => form[field] === true), required: false },
    { key: "location", label: "Map pin", step: "location", done: isValidLatLng(form.location_lat, form.location_lng), required: true },
    { key: "photos", label: `At least ${MIN_PHOTOS} photos`, step: "photos", done: photoCount >= MIN_PHOTOS, required: true },
  ];
}

export function completeness(form: WizardForm, photoCount: number) {
  const list = checks(form, photoCount);
  const done = list.filter((check) => check.done).length;
  return {
    percent: Math.round((done / list.length) * 100),
    missingRequired: list.filter((check) => check.required && !check.done),
    checks: list,
  };
}
