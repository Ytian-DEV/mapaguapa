import { useEffect, useState } from "react";
import type { MapPin } from "../map/ListingsMap";
import { fetchMapPins, filtersFromParams, type MapPinRow } from "./browseApi";
import { priceLabel } from "./ListingCard";

export function toMapPin(row: MapPinRow): MapPin | null {
  if (row.location_lat === null || row.location_lng === null) return null;
  return {
    id: row.id,
    name: row.name ?? "Listing",
    lat: row.location_lat,
    lng: row.location_lng,
    priceLabel: row.price_band ? priceLabel(row) : "Ask",
    meta: [row.area, row.accommodation_type].filter(Boolean).join(" · "),
    coverBucket: row.cover_bucket,
    coverPath: row.cover_path,
  };
}

/** Map pins for the current filters (serialised URL params as the key). */
export function useMapPins(filterKey: string, enabled = true) {
  const [pins, setPins] = useState<MapPin[]>([]);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    fetchMapPins(filtersFromParams(new URLSearchParams(filterKey)))
      .then((rows) => {
        if (!cancelled) setPins(rows.map(toMapPin).filter((pin): pin is MapPin => pin !== null));
      })
      .catch(() => {
        // Keep the last pins; the list shows the error state.
      });
    return () => {
      cancelled = true;
    };
  }, [filterKey, enabled]);

  return pins;
}
