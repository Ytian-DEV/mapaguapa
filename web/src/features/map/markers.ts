import L from "leaflet";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
}

const iconCache = new Map<string, L.DivIcon>();

/** Price pill pin from frame 02 ("₱3,000+"). Active = hovered card or selected pin. */
export function priceIcon(label: string, active: boolean) {
  const key = `${label}|${active}`;
  const cached = iconCache.get(key);
  if (cached) return cached;
  const icon = L.divIcon({
    className: "map-pin-wrap",
    html: `<span class="map-pin${active ? " map-pin--active" : ""}">${escapeHtml(label)}</span>`,
    iconSize: undefined,
    iconAnchor: [0, 0],
  });
  iconCache.set(key, icon);
  return icon;
}

const SCHOOL_SVG =
  '<svg aria-hidden="true" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10 12 5 2 10l10 5 10-5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>';

let vsuIconCache: L.DivIcon | null = null;

/** "VSU Main Campus" landmark. */
export function vsuIcon(label: string) {
  if (vsuIconCache) return vsuIconCache;
  vsuIconCache = L.divIcon({
    className: "map-pin-wrap",
    html: `<span class="map-landmark"><span class="map-landmark__icon">${SCHOOL_SVG}</span>${escapeHtml(label)}</span>`,
    iconSize: undefined,
    iconAnchor: [0, 0],
  });
  return vsuIconCache;
}

let dotIconCache: L.DivIcon | null = null;

/** Single-location marker (listing detail, wizard picker). */
export function placeIcon() {
  if (dotIconCache) return dotIconCache;
  dotIconCache = L.divIcon({
    className: "map-pin-wrap",
    html: '<span class="map-place"><span class="map-place__dot"></span></span>',
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
  return dotIconCache;
}
