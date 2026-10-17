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

/** Straight-line km from VSU; same formula as app.vsu_distance_km() in SQL. */
export function vsuDistanceKm(lat: number | null | undefined, lng: number | null | undefined) {
  if (!isValidLatLng(lat, lng)) return null;
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad((lat as number) - VSU_LOCATION.lat);
  const dLng = rad((lng as number) - VSU_LOCATION.lng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(VSU_LOCATION.lat)) * Math.cos(rad(lat as number)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

export function formatDistance(km: number | null | undefined) {
  if (km === null || km === undefined || !Number.isFinite(km)) return null;
  if (km < 1) return `${Math.max(50, Math.round((km * 1000) / 50) * 50)} m from VSU`;
  return `${km.toFixed(1)} km from VSU`;
}
