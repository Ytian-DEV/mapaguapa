/**
 * Basemap tiles. v1 used CARTO tiles, which now show "API KEY REQUIRED"
 * watermarks. v2 uses MapTiler raster tiles when VITE_MAPTILER_KEY is set
 * (restrict the key to your domains in the MapTiler dashboard), and falls back
 * to the public OpenStreetMap tiles for local development.
 */
export type TileConfig = {
  url: string;
  attribution: string;
  tileSize: number;
  zoomOffset: number;
  maxZoom: number;
  provider: "maptiler" | "osm";
};

const mapTilerKey = import.meta.env.VITE_MAPTILER_KEY?.trim();
const mapTilerStyle = import.meta.env.VITE_MAPTILER_STYLE?.trim() || "streets-v2-light";

const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" rel="noreferrer" target="_blank">OpenStreetMap</a> contributors';

export const tileConfig: TileConfig = mapTilerKey
  ? {
      url: `https://api.maptiler.com/maps/${encodeURIComponent(mapTilerStyle)}/{z}/{x}/{y}.png?key=${encodeURIComponent(mapTilerKey)}`,
      attribution: `<a href="https://www.maptiler.com/copyright/" rel="noreferrer" target="_blank">&copy; MapTiler</a> ${OSM_ATTRIBUTION}`,
      // MapTiler serves 512px tiles; offset keeps Leaflet's zoom levels aligned.
      tileSize: 512,
      zoomOffset: -1,
      maxZoom: 19,
      provider: "maptiler",
    }
  : {
      url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      attribution: OSM_ATTRIBUTION,
      tileSize: 256,
      zoomOffset: 0,
      maxZoom: 19,
      provider: "osm",
    };

if (!mapTilerKey && import.meta.env.PROD) {
  console.warn("VITE_MAPTILER_KEY is not set; using OpenStreetMap tiles. Set a MapTiler key for production traffic.");
}
