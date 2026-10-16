import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import L, { type Map as LeafletMap } from "leaflet";
import { Link } from "react-router-dom";
import { VSU_LABEL, VSU_LOCATION, type BBox } from "../../lib/geo";
import { publicPhotoUrl } from "../../lib/photos";
import { Toggle } from "../../ui";
import { BaseMap } from "./BaseMap";
import { priceIcon, vsuIcon } from "./markers";

export type MapPin = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  priceLabel: string;
  meta: string;
  coverBucket?: string | null;
  coverPath?: string | null;
};

type ListingsMapProps = {
  pins: MapPin[];
  activeId: string | null;
  onActiveChange: (id: string | null) => void;
  /** null = search as I move is off. */
  bbox: BBox | null;
  onBBoxChange: (bbox: BBox | null) => void;
  className?: string;
  label?: string;
};

function toBBox(map: LeafletMap): BBox {
  const bounds = map.getBounds();
  return [bounds.getSouth(), bounds.getWest(), bounds.getNorth(), bounds.getEast()];
}

/** Fits the view to the pins (and VSU) whenever the result set changes. */
function FitToPins({ pins, enabled, onProgrammaticMove }: { pins: MapPin[]; enabled: boolean; onProgrammaticMove: () => void }) {
  const map = useMap();
  const key = pins.map((pin) => pin.id).join(",");

  useEffect(() => {
    if (!enabled) return;
    const points = pins.map((pin) => L.latLng(pin.lat, pin.lng));
    points.push(L.latLng(VSU_LOCATION.lat, VSU_LOCATION.lng));
    onProgrammaticMove();
    if (points.length === 1) {
      map.setView(points[0], 15);
    } else {
      map.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 16 });
    }
    // Only refit when the set of pins changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, map]);

  return null;
}

/** Reports the visible area after the user pans or zooms (debounced). */
function MoveWatcher({ active, isProgrammatic, onMoved }: { active: boolean; isProgrammatic: () => boolean; onMoved: (bbox: BBox) => void }) {
  const timer = useRef<number | undefined>(undefined);
  const map = useMapEvents({
    moveend() {
      if (!active || isProgrammatic()) return;
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => onMoved(toBBox(map)), 350);
    },
  });
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return null;
}

function PinMarker({ pin, active, onActiveChange }: { pin: MapPin; active: boolean; onActiveChange: (id: string | null) => void }) {
  const markerRef = useRef<L.Marker | null>(null);
  const photo = publicPhotoUrl(pin.coverBucket, pin.coverPath);

  useEffect(() => {
    if (active) markerRef.current?.setZIndexOffset(1000);
    else markerRef.current?.setZIndexOffset(0);
  }, [active]);

  return (
    <Marker
      alt={`${pin.name}, ${pin.priceLabel}`}
      eventHandlers={{
        click: () => onActiveChange(pin.id),
        mouseover: () => onActiveChange(pin.id),
        mouseout: () => {
          if (!markerRef.current?.isPopupOpen()) onActiveChange(null);
        },
        popupclose: () => onActiveChange(null),
      }}
      icon={priceIcon(pin.priceLabel, active)}
      keyboard
      position={[pin.lat, pin.lng]}
      ref={markerRef}
      title={pin.name}
    >
      <Popup closeButton={false} offset={[0, -14]}>
        <Link className="map-popup" to={`/listing/${pin.id}`}>
          <span className="map-popup__photo">{photo && <img alt="" loading="lazy" src={photo} />}</span>
          <span className="map-popup__body">
            <span className="map-popup__name">{pin.name}</span>
            <span className="map-popup__meta">
              {pin.priceLabel} /mo{pin.meta ? ` · ${pin.meta}` : ""}
            </span>
          </span>
        </Link>
      </Popup>
    </Marker>
  );
}

export function ListingsMap({ pins, activeId, onActiveChange, bbox, onBBoxChange, className, label = "Map of places near VSU" }: ListingsMapProps) {
  const [map, setMap] = useState<LeafletMap | null>(null);
  const programmaticUntil = useRef(0);
  const searchAsMove = bbox !== null;

  const markProgrammatic = useCallback(() => {
    programmaticUntil.current = Date.now() + 800;
  }, []);
  const isProgrammatic = useCallback(() => Date.now() < programmaticUntil.current, []);

  const visiblePins = useMemo(() => pins.filter((pin) => Number.isFinite(pin.lat) && Number.isFinite(pin.lng)), [pins]);

  const toggleSearchAsMove = (on: boolean) => {
    onBBoxChange(on && map ? toBBox(map) : null);
  };

  return (
    <BaseMap
      className={className}
      label={label}
      onReady={setMap}
      overlay={
        <div className="map-overlay map-overlay--top-left">
          <Toggle checked={searchAsMove} label="Search as I move the map" onChange={(event) => toggleSearchAsMove(event.target.checked)} />
        </div>
      }
    >
      <FitToPins enabled={!searchAsMove} onProgrammaticMove={markProgrammatic} pins={visiblePins} />
      <MoveWatcher active={searchAsMove} isProgrammatic={isProgrammatic} onMoved={(next) => onBBoxChange(next)} />
      <Marker icon={vsuIcon(VSU_LABEL)} interactive={false} keyboard={false} position={[VSU_LOCATION.lat, VSU_LOCATION.lng]} zIndexOffset={-100} />
      {visiblePins.map((pin) => (
        <PinMarker active={pin.id === activeId} key={pin.id} onActiveChange={onActiveChange} pin={pin} />
      ))}
    </BaseMap>
  );
}
