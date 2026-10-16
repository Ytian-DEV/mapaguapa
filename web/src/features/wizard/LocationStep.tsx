import { useState } from "react";
import { Crosshair, MapPin } from "lucide-react";
import { Marker, useMapEvents } from "react-leaflet";
import type { Map as LeafletMap, Marker as LeafletMarker } from "leaflet";
import { formatDistance, isValidLatLng, vsuDistanceKm, VSU_LABEL, VSU_LOCATION } from "../../lib/geo";
import { Button } from "../../ui";
import { BaseMap } from "../map/BaseMap";
import { placeIcon, vsuIcon } from "../map/markers";
import type { StepProps } from "./StepsBasic";

function ClickToPlace({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(event) {
      onPick(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

/** Step 6: tap the map (or drag the pin) to set the exact location. */
export function LocationStep({ form, setFields }: StepProps) {
  const [map, setMap] = useState<LeafletMap | null>(null);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const hasPin = isValidLatLng(form.location_lat, form.location_lng);
  const lat = form.location_lat as number;
  const lng = form.location_lng as number;
  const distance = hasPin ? formatDistance(vsuDistanceKm(lat, lng)) : null;

  const pick = (nextLat: number, nextLng: number) => setFields({ location_lat: Number(nextLat.toFixed(6)), location_lng: Number(nextLng.toFixed(6)) });

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setGeoError("Your browser can’t share its location. Tap the map instead.");
      return;
    }
    setLocating(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        pick(position.coords.latitude, position.coords.longitude);
        map?.setView([position.coords.latitude, position.coords.longitude], 17);
      },
      () => {
        setLocating(false);
        setGeoError("Couldn’t get your location. Tap the map to place the pin instead.");
      },
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  };

  return (
    <section className="wizard-section">
      <div className="wizard-section__head">
        <h2>Map pin</h2>
        <p>Tap the map where the entrance is, then drag the pin to fine-tune. Students see the distance to VSU.</p>
      </div>
      <div className="wizard-map">
        <BaseMap
          center={hasPin ? [lat, lng] : [VSU_LOCATION.lat, VSU_LOCATION.lng]}
          label="Pick the listing location"
          onReady={setMap}
          zoom={hasPin ? 17 : 15}
        >
          <ClickToPlace onPick={pick} />
          <Marker icon={vsuIcon(VSU_LABEL)} interactive={false} keyboard={false} position={[VSU_LOCATION.lat, VSU_LOCATION.lng]} />
          {hasPin && (
            <Marker
              draggable
              eventHandlers={{
                dragend(event) {
                  const position = (event.target as LeafletMarker).getLatLng();
                  pick(position.lat, position.lng);
                },
              }}
              icon={placeIcon()}
              position={[lat, lng]}
            />
          )}
        </BaseMap>
      </div>
      <div className="wizard-map__foot">
        <p className="wizard-map__status">
          <MapPin aria-hidden="true" />
          {hasPin ? (
            <>
              Pin set{distance ? ` · ${distance}` : ""} <span className="v2-muted">({lat.toFixed(5)}, {lng.toFixed(5)})</span>
            </>
          ) : (
            "No pin yet — tap the map."
          )}
        </p>
        <div className="wizard-map__actions">
          <Button leadingIcon={<Crosshair />} loading={locating} onClick={useMyLocation} size="sm" variant="secondary">
            I’m at the place now
          </Button>
          {hasPin && (
            <Button onClick={() => setFields({ location_lat: null, location_lng: null })} size="sm" variant="ghost">
              Remove pin
            </Button>
          )}
        </div>
      </div>
      {geoError && (
        <p className="ui-field__error" role="alert">
          {geoError}
        </p>
      )}
    </section>
  );
}
