import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ListingsMap } from "../map/ListingsMap";
import { BrowseView } from "./BrowseView";
import {
  EMPTY_FILTERS,
  fetchBrowsePage,
  fetchFilterOptions,
  filtersFromParams,
  filtersToParams,
  type BrowseFilters,
  type FilterOptions,
  type ListingCardRow,
} from "./browseApi";
import { useMapPins } from "./useMapPins";
import { useSaved } from "./SavedContext";
import { reportError } from "../../lib/errors";

const PAGE_SIZE = 12;

export default function BrowsePage() {
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => filtersFromParams(params), [params]);
  const filterKey = filtersToParams(filters).toString();
  const { isSaved, toggleSaved } = useSaved();

  const [rows, setRows] = useState<ListingCardRow[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [loadingMore, setLoadingMore] = useState(false);
  const [options, setOptions] = useState<FilterOptions>({ areas: [], types: [] });
  const [reloadToken, setReloadToken] = useState(0);
  const requestId = useRef(0);
  const [activeId, setActiveId] = useState<string | null>(null);
  const pins = useMapPins(filterKey);

  useEffect(() => {
    document.title = "Places near campus · mapaguapa";
  }, []);

  useEffect(() => {
    fetchFilterOptions()
      .then(setOptions)
      .catch(() => setOptions({ areas: [], types: [] }));
  }, []);

  // First page whenever the filters change; stale responses are ignored.
  useEffect(() => {
    const id = ++requestId.current;
    setStatus("loading");
    fetchBrowsePage(filtersFromParams(new URLSearchParams(filterKey)), 0, PAGE_SIZE)
      .then((page) => {
        if (id !== requestId.current) return;
        setRows(page.rows);
        setTotal(page.total);
        setStatus("ready");
      })
      .catch((error) => {
        reportError(error);
        if (id === requestId.current) setStatus("error");
      });
  }, [filterKey, reloadToken]);

  const handleChange = useCallback(
    (patch: Partial<BrowseFilters>) => {
      // Typing and map panning shouldn't flood the back button.
      setParams((current) => filtersToParams({ ...filtersFromParams(current), ...patch }), { replace: "q" in patch || "bbox" in patch });
    },
    [setParams]
  );

  const handleReset = useCallback(() => {
    setParams(filtersToParams({ ...EMPTY_FILTERS, sort: filters.sort }));
  }, [filters.sort, setParams]);

  const handleMore = async () => {
    const id = requestId.current;
    setLoadingMore(true);
    try {
      const page = await fetchBrowsePage(filters, rows.length, PAGE_SIZE);
      if (id !== requestId.current) return;
      setRows((current) => {
        const seen = new Set(current.map((row) => row.id));
        return [...current, ...page.rows.filter((row) => !seen.has(row.id))];
      });
      setTotal(page.total);
    } catch {
      // Keep what is shown; the button stays available to retry.
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <BrowseView
      activeId={activeId}
      aside={
        <ListingsMap
          activeId={activeId}
          bbox={filters.bbox}
          onActiveChange={setActiveId}
          onBBoxChange={(bbox) => handleChange({ bbox })}
          pins={pins}
        />
      }
      filters={filters}
      onActiveChange={setActiveId}
      isSaved={isSaved}
      loadingMore={loadingMore}
      onChange={handleChange}
      onMore={() => void handleMore()}
      onReset={handleReset}
      onRetry={() => setReloadToken((value) => value + 1)}
      onToggleSaved={(listing) => void toggleSaved(listing.id, listing.name ?? undefined)}
      options={options}
      rows={rows}
      status={status}
      total={total}
    />
  );
}
