export type LatLng = { lat: number; lng: number };

/** [south, west, north, east] in degrees. */
export type BBox = [number, number, number, number];

/** VSU Main Campus, Baybay City. Keep in sync with app.vsu_distance_km() in the admin migration. */
export const VSU_LOCATION: LatLng = { lat: 10.7446, lng: 124.7928 };
export const VSU_LABEL = "VSU Main Campus";

/** Default view for maps with nothing to show yet. */
export const DEFAULT_ZOOM = 14;

export function isValidLatLng(lat: number | null | undefined, lng: number | null | undefined): boolean {
  return typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

export function parseBBox(value: string | null): BBox | null {
  if (!value) return null;
  const parts = value.split(",").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) return null;
  const [south, west, north, east] = parts;
  if (south >= north || west >= east) return null;
  return [south, west, north, east];
}

export function formatBBox(bbox: BBox) {
  return bbox.map((value) => value.toFixed(5)).join(",");
}

export function formatDistance(km: number | null | undefined) {
  if (km === null || km === undefined || !Number.isFinite(km)) return null;
  if (km < 1) return `${Math.max(50, Math.round((km * 1000) / 50) * 50)} m from VSU`;
  return `${km.toFixed(1)} km from VSU`;
}
