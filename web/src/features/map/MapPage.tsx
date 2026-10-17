import { useCallback, useEffect, useMemo, useState } from "react";
import { List } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { PRICE_BAND_LABELS, PRICE_BANDS } from "../../lib/domain";
import { ButtonLink, Chip, ChipGroup } from "../../ui";
import { EXCLUSIVITY_GROUPS, EXCLUSIVITY_LABELS, filtersFromParams, filtersToParams, type BrowseFilters } from "../browse/browseApi";
import { useMapPins } from "../browse/useMapPins";
import { ListingsMap } from "./ListingsMap";
import "./map-page.css";

/** Full-screen map ("Map view" in the nav). Shares filters with Browse via the URL. */
export default function MapPage() {
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => filtersFromParams(params), [params]);
  const filterKey = filtersToParams(filters).toString();
  const pins = useMapPins(filterKey);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Map view · mapaguapa";
  }, []);

  const update = useCallback(
    (patch: Partial<BrowseFilters>) =>
      setParams((current) => filtersToParams({ ...filtersFromParams(current), ...patch }), { replace: "bbox" in patch }),
    [setParams]
  );

  const listHref = `/${filterKey ? `?${filtersToParams({ ...filters, bbox: null }).toString()}` : ""}`;

  return (
    <div className="map-page">
      <div className="v2-container map-page__bar">
        <div className="map-page__title">
          <h1 className="v2-h3">Map view</h1>
          <span aria-live="polite" className="map-page__count">
            {pins.length} {pins.length === 1 ? "place" : "places"} on the map
          </span>
        </div>
        <ChipGroup label="Quick filters">
          {PRICE_BANDS.map((band) => (
            <Chip key={band} onClick={() => update({ band: filters.band === band ? "" : band })} selected={filters.band === band}>
              {PRICE_BAND_LABELS[band]}
            </Chip>
          ))}
          {EXCLUSIVITY_GROUPS.map((group) => (
            <Chip key={group} onClick={() => update({ who: filters.who === group ? "" : group })} selected={filters.who === group}>
              {EXCLUSIVITY_LABELS[group]}
            </Chip>
          ))}
        </ChipGroup>
        <ButtonLink leadingIcon={<List />} size="sm" to={listHref} variant="secondary">
          List view
        </ButtonLink>
      </div>
      <div className="map-page__map">
        <ListingsMap activeId={activeId} bbox={filters.bbox} onActiveChange={setActiveId} onBBoxChange={(bbox) => update({ bbox })} pins={pins} />
      </div>
    </div>
  );
}
