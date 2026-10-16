import { Button, Checkbox, Drawer, FilterSelect, Toggle, type SelectOption } from "../../ui";
import { AMENITIES, AMENITY_LABELS, type Amenity, type BrowseFilters } from "./browseApi";

type FiltersDrawerProps = {
  open: boolean;
  onClose: () => void;
  filters: BrowseFilters;
  onChange: (patch: Partial<BrowseFilters>) => void;
  onReset: () => void;
  total: number;
  selects: Array<{ key: "area" | "band" | "type" | "who"; label: string; options: SelectOption[] }>;
};

/** "Filters" sheet: amenities and curfew everywhere, plus the main selects on phones. */
export function FiltersDrawer({ open, onClose, filters, onChange, onReset, total, selects }: FiltersDrawerProps) {
  const toggleAmenity = (amenity: Amenity, checked: boolean) => {
    const next = new Set(filters.amenities);
    if (checked) next.add(amenity);
    else next.delete(amenity);
    onChange({ amenities: AMENITIES.filter((value) => next.has(value)) });
  };

  return (
    <Drawer className="browse-drawer" onClose={onClose} open={open} side="right" title="Filters">
      <div className="browse-drawer__body">
        <section className="browse-drawer__section browse-drawer__selects">
          <h3 className="browse-drawer__heading">Basics</h3>
          {selects.map((select) => (
            <FilterSelect
              key={select.key}
              label={select.label}
              onChange={(event) => onChange({ [select.key]: event.target.value } as Partial<BrowseFilters>)}
              options={select.options}
              value={filters[select.key]}
            />
          ))}
        </section>

        <section className="browse-drawer__section">
          <h3 className="browse-drawer__heading">House rules</h3>
          <Toggle checked={filters.noCurfew} label="No curfew" onChange={(event) => onChange({ noCurfew: event.target.checked })} />
        </section>

        <section className="browse-drawer__section">
          <h3 className="browse-drawer__heading">Amenities</h3>
          <div className="browse-drawer__checks">
            {AMENITIES.map((amenity) => (
              <Checkbox
                checked={filters.amenities.includes(amenity)}
                key={amenity}
                label={AMENITY_LABELS[amenity]}
                onChange={(event) => toggleAmenity(amenity, event.target.checked)}
              />
            ))}
          </div>
        </section>
      </div>
      <div className="browse-drawer__footer">
        <Button onClick={onReset} variant="ghost">
          Clear all
        </Button>
        <Button onClick={onClose}>Show {total} {total === 1 ? "place" : "places"}</Button>
      </div>
    </Drawer>
  );
}
