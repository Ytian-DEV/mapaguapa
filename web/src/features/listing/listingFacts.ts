import { PRICE_BAND_LABELS, type PriceBand } from "../../lib/domain";
import { formatPeso } from "../../lib/format";
import type { ListingDetail } from "./detailApi";

/** Turns the wide v1/v2 listing row into the sections of frame 03. Pure; no React. */

const yesNo = (value: boolean | null | undefined, yes = "Yes", no = "No") => (value === null || value === undefined ? null : value ? yes : no);

export function exclusivityLabel(listing: ListingDetail) {
  switch (listing.exclusivity_group) {
    case "ladies":
      return { label: "Ladies only", hint: "female tenants only" };
    case "men":
      return { label: "Men only", hint: "male tenants only" };
    case "mixed":
      return { label: "Mixed", hint: "open to all genders" };
    default:
      return listing.exclusivity ? { label: listing.exclusivity, hint: "" } : null;
  }
}

export function hasCurfew(curfew: string | null | undefined) {
  if (!curfew || !curfew.trim()) return null;
  return !/^\s*(no(ne)?|n\/?a|wala|no curfew|none\.?)\s*$/i.test(curfew);
}

export function occupancyLabel(listing: ListingDetail) {
  if (listing.occupancy_label?.trim()) return listing.occupancy_label.trim();
  const { occupancy_min: min, occupancy_max: max } = listing;
  if (min && max) return min === max ? `${min} per room` : `${min}–${max} per room`;
  if (max) return `Up to ${max} per room`;
  return null;
}

export function priceSummary(listing: ListingDetail) {
  if (listing.rent_exact !== null && listing.rent_exact !== undefined) {
    const max = listing.monthly_rent_max;
    return {
      amount: formatPeso(Number(listing.rent_exact)),
      suffix: max && Number(max) > Number(listing.rent_exact) ? "and up / month" : "/ month",
      band: listing.price_band ? PRICE_BAND_LABELS[listing.price_band as PriceBand] : null,
    };
  }
  if (listing.price_band) {
    return { amount: PRICE_BAND_LABELS[listing.price_band as PriceBand], suffix: "/ month", band: null };
  }
  return { amount: listing.monthly_rental_label || "Ask the owner", suffix: listing.monthly_rental_label ? "/ month" : "", band: null };
}

export type FactTile = { label: string; value: string; hint?: string };

export function factTiles(listing: ListingDetail): FactTile[] {
  const tiles: FactTile[] = [];
  const price = priceSummary(listing);
  tiles.push({ label: "Monthly rent", value: listing.price_band ? PRICE_BAND_LABELS[listing.price_band as PriceBand] : price.amount, hint: "per person" });

  const rooms = listing.rooms_total ?? listing.rooms_available;
  if (rooms) {
    tiles.push({
      label: "Rooms",
      value: String(rooms),
      hint: [listing.rooms_total && listing.rooms_available !== null ? `${listing.rooms_available} available` : null, occupancyLabel(listing)]
        .filter(Boolean)
        .join(" · "),
    });
  }

  const exclusivity = exclusivityLabel(listing);
  if (exclusivity) tiles.push({ label: "Exclusivity", value: exclusivity.label, hint: exclusivity.hint });

  const curfew = hasCurfew(listing.curfew);
  if (curfew !== null) {
    tiles.push({ label: "Curfew", value: curfew ? "Yes" : "No", hint: curfew ? listing.curfew ?? "ask owner for time" : "come and go freely" });
  }
  return tiles;
}

export function metaLine(listing: ListingDetail) {
  const parts: string[] = [];
  const rooms = listing.rooms_total ?? listing.rooms_available;
  if (rooms) parts.push(`${rooms} ${rooms === 1 ? "room" : "rooms"}`);
  if (listing.floor_count) parts.push(`${listing.floor_count} ${listing.floor_count === 1 ? "floor" : "floors"}`);
  else if (listing.floors_label) parts.push(listing.floors_label);
  const occupancy = occupancyLabel(listing);
  if (occupancy) parts.push(occupancy);
  const curfew = hasCurfew(listing.curfew);
  if (curfew !== null) parts.push(curfew ? "With curfew" : "No curfew");
  return parts;
}

const AMENITY_FIELDS: Array<[keyof ListingDetail, string]> = [
  ["has_wifi", "Wi‑Fi"],
  ["has_study_area", "Study area"],
  ["has_common_kitchen", "Kitchen"],
  ["has_laundry_area", "Laundry area"],
  ["has_drying_area", "Drying area"],
  ["has_parking_area", "Parking"],
  ["has_comfort_room_each_room", "CR in every room"],
  ["has_bathroom_each_floor", "Bathroom on each floor"],
  ["has_charging_slots_each_room", "Charging outlets"],
  ["has_electric_fans", "Electric fans"],
  ["has_aircon", "Air-conditioning"],
  ["is_fenced", "Fenced property"],
  ["has_refrigerator", "Refrigerator"],
  ["has_television", "Television"],
];

export function amenities(listing: ListingDetail) {
  const list = AMENITY_FIELDS.filter(([field]) => listing[field] === true).map(([, label]) => label);
  if (listing.other_amenities?.trim()) {
    listing.other_amenities
      .split(/[,;\n]/)
      .map((item) => item.trim())
      .filter(Boolean)
      .forEach((item) => list.push(item));
  }
  return list;
}

export type Row = { label: string; value: string };

export function billRows(listing: ListingDetail): Row[] {
  const rows: Row[] = [];
  if (listing.bills_included?.trim()) rows.push({ label: "Included in rent", value: listing.bills_included.trim() });
  else if (listing.utilities_included !== null) rows.push({ label: "Utilities included", value: listing.utilities_included ? "Yes" : "No" });
  if (listing.bills_not_included?.trim()) rows.push({ label: "Paid separately", value: listing.bills_not_included.trim() });
  if (listing.advance_deposit?.trim()) rows.push({ label: "Advance & deposit", value: listing.advance_deposit.trim() });
  if (listing.has_additional_appliance_fee) {
    const amount = listing.appliance_fee_amount ? formatPeso(Number(listing.appliance_fee_amount)) : null;
    rows.push({ label: "Appliance fee", value: listing.appliance_fee_label?.trim() || amount || "Yes" });
  } else if (listing.has_additional_appliance_fee === false) {
    rows.push({ label: "Appliance fee", value: "None" });
  }
  const signals = listing.cellular_signals?.length ? listing.cellular_signals.join(" · ") : listing.cellular_signals_raw?.trim();
  if (signals) rows.push({ label: "Mobile signal", value: signals });
  return rows;
}

export function ruleRows(listing: ListingDetail): Row[] {
  const rows: Row[] = [];
  const curfew = hasCurfew(listing.curfew);
  if (curfew !== null) rows.push({ label: "Curfew", value: curfew ? listing.curfew?.trim() || "Yes" : "None" });
  const visitors = yesNo(listing.visitors_allowed, "Allowed", "Not allowed");
  if (visitors) rows.push({ label: "Visitors", value: listing.visitors_allowed && listing.visitor_time?.trim() ? `Allowed · ${listing.visitor_time.trim()}` : visitors });
  const pets = yesNo(listing.pets_allowed, "Allowed", "Not allowed");
  if (pets) rows.push({ label: "Pets", value: pets });
  const smoking = yesNo(listing.smoking_allowed, "Allowed", "Not allowed");
  if (smoking) rows.push({ label: "Smoking", value: smoking });
  return rows;
}

const SAFETY_FIELDS: Array<[keyof ListingDetail, string]> = [
  ["has_security_cctv", "CCTV"],
  ["has_fire_alarm", "Fire alarm"],
  ["has_smoke_detector", "Smoke detector"],
  ["has_fire_extinguisher", "Fire extinguisher"],
  ["has_sprinkler", "Sprinkler"],
  ["has_emergency_exit", "Emergency exit"],
  ["has_emergency_lights", "Emergency lights"],
];

export function safetyFeatures(listing: ListingDetail) {
  return SAFETY_FIELDS.filter(([field]) => listing[field] === true).map(([, label]) => label);
}

/** Short "Internet & water included" badge for the contact card. */
export function includedBadge(listing: ListingDetail) {
  const text = listing.bills_included?.trim();
  if (!text) return listing.utilities_included ? "Utilities included" : null;
  const items = text
    .split(/[,;&/]|\band\b/i)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  if (items.length === 0) return null;
  const pretty = items.slice(0, 2).map((item, index) => (index === 0 ? item.charAt(0).toUpperCase() + item.slice(1) : item));
  return `${pretty.join(" & ")}${items.length > 2 ? " +" : ""} included`;
}

export function directionsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

/** Digits only, kept with a leading + for tel: links. */
export function telHref(number: string) {
  const cleaned = number.replace(/[^\d+]/g, "");
  return cleaned ? `tel:${cleaned}` : null;
}

export { yesNo };
