import { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import type { LatLngExpression, LeafletMouseEvent, Map as LeafletMap } from "leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type PropertyCoordinates = {
  lat: number;
  lng: number;
};

type PropertyMapProps = {
  coordinates: PropertyCoordinates | null;
  mode: "picker" | "readonly";
  onChange?: (coordinates: PropertyCoordinates) => void;
};

const defaultCenter: PropertyCoordinates = { lat: 10.746, lng: 124.793 };
const tileUrl = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
const tileAttribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

const markerIcon = L.divIcon({
  className: "mapa-property-map__marker",
  html: '<span class="mapa-property-map__marker-pin"></span>',
  iconSize: [34, 42],
  iconAnchor: [17, 40],
});

function MapResizeWatcher({ coordinates }: { coordinates: PropertyCoordinates | null }) {
  const map = useMap();

  useEffect(() => {
    const timers = [window.setTimeout(() => map.invalidateSize(), 80), window.setTimeout(() => map.invalidateSize(), 260)];
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [coordinates, map]);

  useEffect(() => {
    if (coordinates) {
      map.setView([coordinates.lat, coordinates.lng], Math.max(map.getZoom(), 15), { animate: true });
    }
  }, [coordinates, map]);

  return null;
}

function MapClickHandler({ onChange }: { onChange?: (coordinates: PropertyCoordinates) => void }) {
  useMapEvents({
    click(event: LeafletMouseEvent) {
      onChange?.({ lat: event.latlng.lat, lng: event.latlng.lng });
    },
  });

  return null;
}

export function PropertyMap({ coordinates, mode, onChange }: PropertyMapProps) {
  const center = useMemo<LatLngExpression>(
    () => [coordinates?.lat ?? defaultCenter.lat, coordinates?.lng ?? defaultCenter.lng],
    [coordinates]
  );

  return (
    <MapContainer center={center} className="mapa-property-map" scrollWheelZoom={false} zoom={coordinates ? 16 : 13}>
      <TileLayer attribution={tileAttribution} url={tileUrl} />
      <MapResizeWatcher coordinates={coordinates} />
      {mode === "picker" && <MapClickHandler onChange={onChange} />}
      {coordinates && (
        <Marker
          draggable={mode === "picker"}
          eventHandlers={
            mode === "picker"
              ? {
                  dragend(event) {
                    const marker = event.target as L.Marker;
                    const position = marker.getLatLng();
                    onChange?.({ lat: position.lat, lng: position.lng });
                  },
                }
              : undefined
          }
          icon={markerIcon}
          position={[coordinates.lat, coordinates.lng]}
        />
      )}
    </MapContainer>
  );
}

export function useInvalidateLeafletMaps(trigger: unknown) {
  useEffect(() => {
    const timers = [window.setTimeout(invalidateVisibleMaps, 100), window.setTimeout(invalidateVisibleMaps, 320)];
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [trigger]);
}

function invalidateVisibleMaps() {
  document.querySelectorAll<HTMLElement>(".leaflet-container").forEach((element) => {
    const map = (element as HTMLElement & { _leaflet_map?: LeafletMap })._leaflet_map;
    map?.invalidateSize();
  });
}
