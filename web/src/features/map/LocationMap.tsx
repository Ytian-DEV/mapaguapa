import { Marker } from "react-leaflet";
import { VSU_LABEL, VSU_LOCATION } from "../../lib/geo";
import { BaseMap } from "./BaseMap";
import { placeIcon, vsuIcon } from "./markers";

/** Read-only single place with the VSU landmark for reference (listing detail). */
export function LocationMap({ lat, lng, label, className }: { lat: number; lng: number; label: string; className?: string }) {
  return (
    <BaseMap center={[lat, lng]} className={className} label={label} scrollWheelZoom={false} zoom={16}>
      <Marker icon={vsuIcon(VSU_LABEL)} interactive={false} keyboard={false} position={[VSU_LOCATION.lat, VSU_LOCATION.lng]} />
      <Marker alt={label} icon={placeIcon()} keyboard={false} position={[lat, lng]} />
    </BaseMap>
  );
}
