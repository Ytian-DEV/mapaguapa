import { useEffect, useState, type ReactNode } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import type { LatLngExpression, Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";
import { DEFAULT_ZOOM, VSU_LOCATION } from "../../lib/geo";
import { cx } from "../../ui";
import { tileConfig } from "./tiles";
import "./map.css";

/** Leaflet measures its box on mount; re-measure when the container resizes (tabs, toggles, drawers). */
function ResizeWatcher() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(container);
    return () => observer.disconnect();
  }, [map]);
  return null;
}

type BaseMapProps = {
  center?: LatLngExpression;
  zoom?: number;
  className?: string;
  label: string;
  scrollWheelZoom?: boolean;
  /** Leaflet layers (markers, event hooks). */
  children?: ReactNode;
  /** Floating UI drawn above the map but outside Leaflet's event handling. */
  overlay?: ReactNode;
  onReady?: (map: LeafletMap) => void;
};

/** Shared Leaflet map with the v2 basemap and frame 02 zoom control. */
export function BaseMap({
  center = [VSU_LOCATION.lat, VSU_LOCATION.lng],
  zoom = DEFAULT_ZOOM,
  className,
  label,
  scrollWheelZoom = true,
  children,
  overlay,
  onReady,
}: BaseMapProps) {
  const [map, setMap] = useState<LeafletMap | null>(null);

  useEffect(() => {
    if (map) onReady?.(map);
  }, [map, onReady]);

  return (
    <div aria-label={label} className={cx("base-map", className)} role="region">
      <MapContainer
        center={center}
        className="base-map__leaflet"
        ref={setMap}
        scrollWheelZoom={scrollWheelZoom}
        zoom={zoom}
        zoomControl={false}
      >
        <TileLayer
          attribution={tileConfig.attribution}
          maxZoom={tileConfig.maxZoom}
          tileSize={tileConfig.tileSize}
          url={tileConfig.url}
          zoomOffset={tileConfig.zoomOffset}
        />
        <ResizeWatcher />
        {children}
      </MapContainer>
      {map && (
        <div className="base-map__zoom">
          <button aria-label="Zoom in" onClick={() => map.zoomIn()} type="button">
            +
          </button>
          <button aria-label="Zoom out" onClick={() => map.zoomOut()} type="button">
            −
          </button>
        </div>
      )}
      {overlay}
    </div>
  );
}
