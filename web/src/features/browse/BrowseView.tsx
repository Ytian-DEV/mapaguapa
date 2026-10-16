import { useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, ArrowDownUp, List, Map as MapIcon, SearchX, Search, SlidersHorizontal, X } from "lucide-react";
import { PRICE_BAND_LABELS, PRICE_BANDS, type PriceBand } from "../../lib/domain";
import {
  Button,
  Chip,
  ChipGroup,
  EmptyState,
  FilterSelect,
  Input,
  ListingCardSkeleton,
  LoadingRegion,
  Segmented,
  ShowMore,
  cx,
  type SelectOption,
} from "../../ui";
import {
  activeFilterCount,
  EXCLUSIVITY_GROUPS,
  EXCLUSIVITY_LABELS,
  SORT_LABELS,
  SORTS,
  type BrowseFilters,
  type BrowseSort,
  type FilterOptions,
  type ListingCardRow,
} from "./browseApi";
import { FiltersDrawer } from "./FiltersDrawer";
import { ListingCard } from "./ListingCard";
import "./browse.css";

export type BrowseViewProps = {
  filters: BrowseFilters;
  onChange: (patch: Partial<BrowseFilters>) => void;
  onReset: () => void;
  options: FilterOptions;
  rows: ListingCardRow[];
  total: number;
  status: "loading" | "ready" | "error";
  loadingMore: boolean;
  onMore: () => void;
  onRetry: () => void;
  isSaved: (id: string) => boolean;
  onToggleSaved: (listing: ListingCardRow) => void;
  /** Map panel. Beside the grid from 1280px; behind a List / Map toggle below that. */
  aside?: ReactNode;
  /** Card highlighted from the map, and the card the pointer is on. */
  activeId?: string | null;
  onActiveChange?: (id: string | null) => void;
};

const SEARCH_DEBOUNCE_MS = 300;

export function BrowseView({
  filters,
  onChange,
  onReset,
  options,
  rows,
  total,
  status,
  loadingMore,
  onMore,
  onRetry,
  isSaved,
  onToggleSaved,
  aside,
  activeId = null,
  onActiveChange,
}: BrowseViewProps) {
  const [search, setSearch] = useState(filters.q);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [smallView, setSmallView] = useState<"list" | "map">("list");

  // Keep the box in sync when the URL changes (back button, chip resets).
  useEffect(() => setSearch(filters.q), [filters.q]);

  useEffect(() => {
    if (search === filters.q) return undefined;
    const timer = window.setTimeout(() => onChange({ q: search }), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [search, filters.q, onChange]);

  const selects: Array<{ key: "area" | "band" | "type" | "who"; label: string; options: SelectOption[] }> = [
    { key: "area", label: "Area", options: options.areas.map((area) => ({ value: area, label: area })) },
    { key: "band", label: "Budget", options: PRICE_BANDS.map((band) => ({ value: band, label: PRICE_BAND_LABELS[band] })) },
    { key: "type", label: "Type", options: options.types.map((type) => ({ value: type, label: type })) },
    { key: "who", label: "Exclusivity", options: EXCLUSIVITY_GROUPS.map((group) => ({ value: group, label: EXCLUSIVITY_LABELS[group] })) },
  ];

  const filterCount = activeFilterCount(filters);
  const quickAll = !filters.band && !filters.who && !filters.noCurfew && !filters.amenities.includes("wifi");
  const toggleBand = (band: PriceBand) => onChange({ band: filters.band === band ? "" : band });
  const placesLabel = `${total} ${total === 1 ? "place" : "places"}`;

  return (
    <div className="browse v2-container">
      <header className="browse__header">
        <div className="browse__title-row">
          <div className="browse__title">
            <p className="v2-eyebrow">Baybay City · Around VSU</p>
            <h1 className="browse__h1">Places near campus</h1>
          </div>
          <div className="browse__sort">
            <span aria-live="polite" className="browse__count">
              {status === "loading" ? "Loading…" : placesLabel}
            </span>
            <span aria-hidden="true" className="browse__dot">
              ·
            </span>
            <label className="browse__sort-control">
              <ArrowDownUp aria-hidden="true" />
              <span className="v2-sr-only">Sort by</span>
              <select onChange={(event) => onChange({ sort: event.target.value as BrowseSort })} value={filters.sort}>
                {SORTS.map((sort) => (
                  <option key={sort} value={sort}>
                    {SORT_LABELS[sort]}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="browse__search-row" role="search">
          <Input
            aria-label="Search listings"
            className="browse__search"
            inputSize="lg"
            leadingIcon={<Search />}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search a barangay, street, or place name"
            trailing={
              search ? (
                <button aria-label="Clear search" className="browse__clear" onClick={() => setSearch("")} type="button">
                  <X />
                </button>
              ) : undefined
            }
            type="search"
            value={search}
          />
          {selects.map((select) => (
            <FilterSelect
              className="browse__select"
              key={select.key}
              label={select.label}
              onChange={(event) => onChange({ [select.key]: event.target.value } as Partial<BrowseFilters>)}
              options={select.options}
              value={filters[select.key]}
            />
          ))}
          <Button
            aria-expanded={drawerOpen}
            className="browse__filters-btn"
            leadingIcon={<SlidersHorizontal />}
            onClick={() => setDrawerOpen(true)}
            size="lg"
            variant="dark"
          >
            <span className="browse__filters-label">Filters</span>
            {filterCount > 0 && <span className="browse__filters-count">{filterCount}</span>}
          </Button>
        </div>

        <ChipGroup label="Quick filters">
          <Chip onClick={onReset} selected={quickAll && filterCount === 0}>
            All
          </Chip>
          {PRICE_BANDS.map((band) => (
            <Chip key={band} onClick={() => toggleBand(band)} selected={filters.band === band}>
              {PRICE_BAND_LABELS[band]}
            </Chip>
          ))}
          {EXCLUSIVITY_GROUPS.map((group) => (
            <Chip key={group} onClick={() => onChange({ who: filters.who === group ? "" : group })} selected={filters.who === group}>
              {EXCLUSIVITY_LABELS[group]}
            </Chip>
          ))}
          <Chip onClick={() => onChange({ noCurfew: !filters.noCurfew })} selected={filters.noCurfew}>
            No curfew
          </Chip>
          <Chip
            onClick={() =>
              onChange({
                amenities: filters.amenities.includes("wifi")
                  ? filters.amenities.filter((value) => value !== "wifi")
                  : [...filters.amenities, "wifi"],
              })
            }
            selected={filters.amenities.includes("wifi")}
          >
            With Wi‑Fi
          </Chip>
        </ChipGroup>

        {aside && (
          <Segmented
            className="browse__view-toggle"
            items={[
              { value: "list", label: <><List aria-hidden="true" /> List</> },
              { value: "map", label: <><MapIcon aria-hidden="true" /> Map</> },
            ]}
            label="Show results as"
            onChange={setSmallView}
            value={smallView}
          />
        )}
      </header>

      <div className={cx("browse__body", aside && "browse__body--with-aside", aside && smallView === "map" && "browse__body--map-mode")}>
        <section aria-label="Results" className="browse__results">
          {status === "loading" && (
            <LoadingRegion label="Loading places">
              <div className="browse__grid">
                {Array.from({ length: 6 }, (_, index) => (
                  <ListingCardSkeleton key={index} />
                ))}
              </div>
            </LoadingRegion>
          )}

          {status === "error" && (
            <EmptyState
              action={
                <Button onClick={onRetry} variant="secondary">
                  Try again
                </Button>
              }
              description="Check your connection and try again."
              icon={<AlertTriangle />}
              title="Couldn’t load places"
              tone="error"
            />
          )}

          {status === "ready" && rows.length === 0 && (
            <EmptyState
              action={
                filterCount > 0 || filters.q ? (
                  <Button onClick={onReset} variant="secondary">
                    Clear filters
                  </Button>
                ) : undefined
              }
              description={filterCount > 0 || filters.q ? "Try a different budget, area or search." : "New places are added every week."}
              icon={<SearchX />}
              title={filterCount > 0 || filters.q ? "No places match" : "No places listed yet"}
            />
          )}

          {status === "ready" && rows.length > 0 && (
            <>
              <div className="browse__grid">
                {rows.map((listing) => (
                  <ListingCard
                    active={listing.id === activeId}
                    key={listing.id}
                    listing={listing}
                    onHover={onActiveChange ? (hovering) => onActiveChange(hovering ? listing.id : null) : undefined}
                    onToggleSaved={() => onToggleSaved(listing)}
                    saved={isSaved(listing.id)}
                  />
                ))}
              </div>
              <ShowMore loading={loadingMore} onMore={onMore} shown={rows.length} total={total} />
            </>
          )}
        </section>
        {aside && <aside className="browse__aside">{aside}</aside>}
      </div>

      <FiltersDrawer
        filters={filters}
        onChange={onChange}
        onClose={() => setDrawerOpen(false)}
        onReset={onReset}
        open={drawerOpen}
        selects={selects}
        total={total}
      />
    </div>
  );
}
