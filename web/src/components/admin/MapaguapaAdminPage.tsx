import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from "react";
import {
  draftToListingPayload,
  emptyListingDraft,
  fetchAdminListings,
  fetchDeletedListings,
  listingToDraft,
  type ListingDraft,
} from "../../lib/listingService";
import {
  formatSignals,
  getListingCover,
  labelBoolean,
  toPublicPhotoUrl,
  type DeletedListingRow,
  type ListingPhotoRow,
  type ListingWithPhotos,
  type Profile,
} from "../../lib/models";
import { compressImageForUpload } from "../../lib/imageCompression";
import { listingPhotosBucket, supabase } from "../../lib/supabase";
import HouseMark from "../shared/HouseMark";
import { PropertyMap, type PropertyCoordinates } from "../shared/PropertyMap";
import { usePointerGlow } from "../shared/usePointerGlow";
import "./mapaguapa-admin.css";

type AdminSection = "overview" | "add" | "edit" | "archive" | "users";

type MapaguapaAdminPageProps = {
  onSignOut: () => Promise<void>;
  profile: Profile;
};

const checklist = [
  "Profiles stay linked to Supabase Auth through public.profiles.",
  "Listing photos are read from listing_photos and the Storage bucket.",
  "Delete actions re-check the admin password before archive runs.",
];

const profileSelect = "id, email, full_name, phone, avatar_url, role, is_active, created_at, updated_at";
const allAdminAreasLabel = "All areas";

const sectionCopy: Record<AdminSection, { label: string; title: string; description: string }> = {
  overview: {
    label: "Overview",
    title: "Operations overview",
    description: "Watch the listing inventory, photo coverage, archive count, and user totals in one cleaner admin frame.",
  },
  add: {
    label: "Add listing",
    title: "Create a new listing",
    description: "Add boarding house data, owner contact details, and the fields you want to publish on the user dashboard.",
  },
  edit: {
    label: "Edit and delete",
    title: "Manage the selected listing",
    description: "Update listing content, review photos, and archive a record when it should no longer appear to students.",
  },
  archive: {
    label: "Archive",
    title: "Archived listings",
    description: "Review records that were removed from the active catalog and kept for audit or recovery.",
  },
  users: {
    label: "Users",
    title: "Registered users",
    description: "See how many accounts exist, who has admin access, and which users are active in the system.",
  },
};

const accommodationTypeOptions = ["Dormitory", "Boarding House", "Apartment", "Others"];
const exclusivityOptions = ["Mixed", "Male", "Female"];
const billOptions = ["Internet", "Water", "Electricity"];

function slugifyPathSegment(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function formatFileSize(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  return `${bytes} B`;
}

function formatPesoLabel(label: string | null | undefined) {
  const value = label?.trim();
  if (!value || value.startsWith("\u20b1")) {
    return value || "Not listed";
  }

  const rangeMatch = value.match(/^(\d[\d,]*)(?:\s*-\s*)(\d[\d,]*)$/);
  if (rangeMatch) {
    return `\u20b1${rangeMatch[1]}-${rangeMatch[2]}`;
  }

  const lessThanMatch = value.match(/^Less than\s+(\d[\d,]*)$/i);
  if (lessThanMatch) {
    return `Less than \u20b1${lessThanMatch[1]}`;
  }

  const orMoreMatch = value.match(/^(\d[\d,]*)\s+or more$/i);
  if (orMoreMatch) {
    return `\u20b1${orMoreMatch[1]} or more`;
  }

  const exactMatch = value.match(/^(\d[\d,]*)$/);
  if (exactMatch) {
    return `\u20b1${exactMatch[1]}`;
  }

  return value;
}

function getDraftCoordinates(draft: ListingDraft): PropertyCoordinates | null {
  const lat = Number.parseFloat(draft.locationLat);
  const lng = Number.parseFloat(draft.locationLng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return { lat, lng };
}

function getAdminAreaLabel(address: string | null | undefined) {
  const value = address?.trim();
  if (!value) {
    return "Unlisted area";
  }

  const lowered = value.toLowerCase();
  if (lowered.includes("pangasugan")) {
    return "Pangasugan";
  }

  if (lowered.includes("utod")) {
    return "Utod";
  }

  if (lowered.includes("guadalupe")) {
    return "Guadalupe";
  }

  return value.split(",")[0]?.trim() || "Unlisted area";
}

export default function MapaguapaAdminPage({ onSignOut, profile }: MapaguapaAdminPageProps) {
  const [section, setSection] = useState<AdminSection>("overview");
  const [listings, setListings] = useState<ListingWithPhotos[]>([]);
  const [deletedListings, setDeletedListings] = useState<DeletedListingRow[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [selectedListingId, setSelectedListingId] = useState("");
  const [activeEditArea, setActiveEditArea] = useState(allAdminAreasLabel);
  const [draft, setDraft] = useState<ListingDraft>({ ...emptyListingDraft });
  const [pendingPhotos, setPendingPhotos] = useState<File[]>([]);
  const [editPendingPhotos, setEditPendingPhotos] = useState<File[]>([]);
  const [showAddPreview, setShowAddPreview] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [photoActionId, setPhotoActionId] = useState<string | null>(null);
  const [photoDeleteTarget, setPhotoDeleteTarget] = useState<ListingPhotoRow | null>(null);
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
  const [archivePassword, setArchivePassword] = useState("");
  const [draggedPhotoId, setDraggedPhotoId] = useState<string | null>(null);
  const [dragOverPhotoId, setDragOverPhotoId] = useState<string | null>(null);
  const [reorderingPhotos, setReorderingPhotos] = useState(false);
  const [restoringArchiveId, setRestoringArchiveId] = useState<string | null>(null);
  const [userActionId, setUserActionId] = useState<string | null>(null);
  const [isAdminMenuOpen, setIsAdminMenuOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locationSearch, setLocationSearch] = useState("");
  const [locationSearching, setLocationSearching] = useState(false);
  const { pageRef, handlePointerEnter, handlePointerLeave, handlePointerMove } = usePointerGlow({
    centerXRatio: 0.68,
    centerYRatio: 0.42,
  });

  const editAreaOptions = useMemo(
    () => [allAdminAreasLabel, ...Array.from(new Set(listings.map((listing) => getAdminAreaLabel(listing.address))))],
    [listings]
  );

  const filteredEditListings = useMemo(
    () => {
      const visibleListings =
        activeEditArea === allAdminAreasLabel
          ? listings
          : listings.filter((listing) => getAdminAreaLabel(listing.address) === activeEditArea);

      return [...visibleListings].sort((left, right) => {
        const leftArea = getAdminAreaLabel(left.address);
        const rightArea = getAdminAreaLabel(right.address);
        const areaOrder = leftArea.localeCompare(rightArea);

        if (areaOrder !== 0) {
          return areaOrder;
        }

        return left.name.localeCompare(right.name);
      });
    },
    [activeEditArea, listings]
  );

  const selectedListing = useMemo(
    () =>
      listings.find((listing) => listing.id === selectedListingId) ??
      (section === "edit" ? filteredEditListings[0] : listings[0]) ??
      null,
    [filteredEditListings, listings, section, selectedListingId]
  );

  const selectedListingPhotos = useMemo(
    () =>
      [...(selectedListing?.listing_photos ?? [])].sort((left, right) => {
        if (left.is_cover !== right.is_cover) {
          return left.is_cover ? -1 : 1;
        }

        return left.sort_order - right.sort_order;
      }),
    [selectedListing]
  );

  const totalPhotos = useMemo(
    () => listings.reduce((sum, listing) => sum + (listing.listing_photos?.length ?? 0), 0),
    [listings]
  );

  const totalAdmins = useMemo(() => users.filter((user) => user.role === "admin").length, [users]);
  const recentListings = useMemo(() => listings.slice(0, 4), [listings]);
  const selectedPhotos = useMemo(() => selectedListingPhotos.slice(0, 3), [selectedListingPhotos]);
  const activeSectionCopy = sectionCopy[section];

  const sidebarItems = useMemo(
    () => [
      { id: "overview" as const, label: "Overview", caption: "Dashboard summary" },
      { id: "add" as const, label: "Add listing", caption: "Create a new record" },
      { id: "edit" as const, label: "Edit and delete", caption: "Update and archive records" },
      { id: "archive" as const, label: "Archive", caption: "Removed listings", badge: deletedListings.length.toString().padStart(2, "0") },
      { id: "users" as const, label: "Total users", caption: "Accounts and roles", badge: users.length.toString().padStart(2, "0") },
    ],
    [deletedListings.length, users.length]
  );

  useEffect(() => {
    void loadDashboard();
  }, []);

  useEffect(() => {
    if (section === "add") {
      setDraft({ ...emptyListingDraft });
      setPendingPhotos([]);
      setShowAddPreview(true);
    }

    if (section === "edit") {
      setDraft(listingToDraft(selectedListing));
      setEditPendingPhotos([]);
    }
  }, [section, selectedListing]);

  useEffect(() => {
    if (section !== "edit") {
      return;
    }

    if (activeEditArea !== allAdminAreasLabel && !editAreaOptions.includes(activeEditArea)) {
      setActiveEditArea(allAdminAreasLabel);
      return;
    }

    if (filteredEditListings.length === 0) {
      setSelectedListingId("");
      return;
    }

    if (!filteredEditListings.some((listing) => listing.id === selectedListingId)) {
      setSelectedListingId(filteredEditListings[0].id);
    }
  }, [activeEditArea, editAreaOptions, filteredEditListings, section, selectedListingId]);

  useEffect(() => {
    if (!photoDeleteTarget && !archiveConfirmOpen) {
      return undefined;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !photoActionId && !archiving) {
        setPhotoDeleteTarget(null);
        setArchiveConfirmOpen(false);
        setArchivePassword("");
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [archiveConfirmOpen, archiving, photoDeleteTarget, photoActionId]);

  async function loadDashboard(preferredListingId?: string) {
    const client = supabase;
    if (!client) {
      setError("Supabase is not configured.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [listingData, deletedData, userResponse] = await Promise.all([
        fetchAdminListings(),
        fetchDeletedListings(),
        client.from("profiles").select(profileSelect).order("created_at", { ascending: false }),
      ]);

      if (userResponse.error) {
        throw userResponse.error;
      }

      setListings(listingData);
      setDeletedListings(deletedData);
      setUsers((userResponse.data ?? []) as Profile[]);
      setSelectedListingId((current) => {
        const candidateId = preferredListingId ?? current;
        if (candidateId && listingData.some((listing) => listing.id === candidateId)) {
          return candidateId;
        }

        return listingData[0]?.id ?? "";
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  }

  function openSection(nextSection: AdminSection) {
    setSection(nextSection);
    setIsAdminMenuOpen(false);
    setFeedback(null);
    setError(null);
  }

  function selectListing(listingId: string) {
    setSelectedListingId(listingId);
    setFeedback(null);
    setError(null);
  }

  function openListingEditor(listingId?: string) {
    if (listingId) {
      setSelectedListingId(listingId);
    }

    setSection("edit");
    setFeedback(null);
    setError(null);
  }

  function updateDraft<K extends keyof ListingDraft>(key: K, value: ListingDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function updateAccommodationType(value: string) {
    setDraft((current) => ({
      ...current,
      accommodationType: value,
      accommodationTypeOther: value === "Others" ? current.accommodationTypeOther : "",
    }));
  }

  function updateBillList(key: "billsIncluded" | "billsNotIncluded", bill: string, checked: boolean) {
    setDraft((current) => {
      const selected = current[key]
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      const next = checked ? Array.from(new Set([...selected, bill])) : selected.filter((item) => item !== bill);

      return { ...current, [key]: next.join(", ") };
    });
  }

  function updateDraftCoordinates(coordinates: PropertyCoordinates) {
    setDraft((current) => ({
      ...current,
      locationLat: coordinates.lat.toFixed(6),
      locationLng: coordinates.lng.toFixed(6),
    }));
  }

  function renderDraftField(
    label: string,
    key: keyof ListingDraft,
    options: { wide?: boolean; rows?: number; disabled?: boolean } = {}
  ) {
    const value = draft[key];

    return (
      <label className={`mapa-admin-page__field${options.wide ? " mapa-admin-page__field--wide" : ""}`}>
        <span>{label}</span>
        {options.rows ? (
          <textarea
            onChange={(event) => updateDraft(key, event.target.value as ListingDraft[typeof key])}
            disabled={options.disabled}
            rows={options.rows}
            value={String(value)}
          />
        ) : (
          <input
            onChange={(event) => updateDraft(key, event.target.value as ListingDraft[typeof key])}
            disabled={options.disabled}
            type="text"
            value={String(value)}
          />
        )}
      </label>
    );
  }

  function renderDraftCheckbox(label: string, key: keyof ListingDraft) {
    return (
      <label className="mapa-admin-page__checkbox">
        <input
          checked={Boolean(draft[key])}
          onChange={(event) => updateDraft(key, event.target.checked as ListingDraft[typeof key])}
          type="checkbox"
        />
        <span>{label}</span>
      </label>
    );
  }

  function renderDraftSelect(label: string, value: string, options: string[], onChange: (value: string) => void) {
    return (
      <label className="mapa-admin-page__field">
        <span>{label}</span>
        <select onChange={(event) => onChange(event.target.value)} value={value}>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
    );
  }

  function renderBillCheckbox(label: string, key: "billsIncluded" | "billsNotIncluded") {
    const selected = draft[key]
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    return (
      <section className="mapa-admin-page__check-cluster">
        <p className="mapa-admin-page__check-cluster-title">{label}</p>
        {billOptions.map((bill) => (
          <label className="mapa-admin-page__checkbox" key={`${key}-${bill}`}>
            <input
              checked={selected.includes(bill)}
              onChange={(event) => updateBillList(key, bill, event.target.checked)}
              type="checkbox"
            />
            <span>{bill}</span>
          </label>
        ))}
      </section>
    );
  }

  function renderDraftGroup(
    title: string,
    children: ReactNode,
    options: { kind?: "fields" | "checks" } = {}
  ) {
    return (
      <section className="mapa-admin-page__form-group">
        <h4 className="mapa-admin-page__form-group-title">{title}</h4>
        <div className={options.kind === "checks" ? "mapa-admin-page__checkbox-grid" : "mapa-admin-page__field-grid"}>
          {children}
        </div>
      </section>
    );
  }

  function renderListingDraftFields() {
    return (
      <>
        {renderDraftGroup("Listing Info", (
          <>
            {renderDraftField("Accommodation name", "name")}
            {renderDraftField("Address", "address")}
            {renderDraftSelect("Accommodation type", draft.accommodationType, accommodationTypeOptions, updateAccommodationType)}
            {renderDraftField("Specific type", "accommodationTypeOther", { disabled: draft.accommodationType !== "Others" })}
            {renderDraftSelect("Exclusivity", draft.exclusivity, exclusivityOptions, (value) => updateDraft("exclusivity", value))}
            {renderDraftField("Monthly rental", "monthlyRentalLabel")}
            {renderDraftField("Rooms available", "roomsAvailable")}
            {renderDraftField("Floors", "floorsLabel")}
            {renderDraftField("Occupancy", "occupancyLabel")}
            {renderDraftField("Description", "description", { wide: true, rows: 4 })}
          </>
        ))}

        {renderDraftGroup("Utilities", (
          <>
            {renderBillCheckbox("Bills included", "billsIncluded")}
            {renderBillCheckbox("Bills not included", "billsNotIncluded")}
            {renderDraftCheckbox("Appliance fee", "applianceFee")}
            {draft.applianceFee && renderDraftField("How much is the fee?", "applianceAmount", { wide: true })}
          </>
        ))}

        {renderDraftGroup("Comfort", (
          <>
            {renderDraftCheckbox("Fenced", "fenced")}
            {renderDraftCheckbox("Comfort room per room", "comfortRoomPerRoom")}
            {renderDraftCheckbox("Separate CR/bath", "separateCrBath")}
            {renderDraftCheckbox("CR/bath per floor", "crBathPerFloor")}
            {renderDraftCheckbox("Charging slots", "chargingSlots")}
            {renderDraftCheckbox("Electric fans", "electricFans")}
            {renderDraftCheckbox("Aircon", "aircon")}
          </>
        ))}

        {renderDraftGroup("Amenities", (
          <>
            {renderDraftField("Other amenities", "otherAmenities", { wide: true, rows: 2 })}
            {renderDraftCheckbox("Wi-Fi available", "wifi")}
            {renderDraftCheckbox("Study area", "studyArea")}
            {renderDraftCheckbox("Parking area", "parkingArea")}
            {renderDraftCheckbox("Laundry area", "laundryArea")}
            {renderDraftCheckbox("Drying area", "dryingArea")}
            {renderDraftCheckbox("Common kitchen", "commonKitchen")}
            {renderDraftCheckbox("Refrigerator", "refrigerator")}
            {renderDraftCheckbox("Television", "television")}
          </>
        ))}

        {renderDraftGroup("Rules", (
          <>
            {renderDraftCheckbox("No curfew", "noCurfew")}
            {renderDraftCheckbox("Pets allowed", "petsAllowed")}
            {renderDraftCheckbox("Visitors allowed", "visitorsAllowed")}
            {renderDraftCheckbox("Smoking allowed", "smokingAllowed")}
          </>
        ))}

        {renderDraftGroup("Safety", (
          <>
            {renderDraftCheckbox("Security/CCTV", "security")}
            {renderDraftCheckbox("Emergency exit", "emergencyExit")}
            {renderDraftCheckbox("Fire alarm", "fireAlarm")}
            {renderDraftCheckbox("Emergency lights", "emergencyLights")}
            {renderDraftCheckbox("Fire extinguisher", "fireExtinguisher")}
            {renderDraftCheckbox("Smoke detector", "smokeDetector")}
            {renderDraftCheckbox("Sprinkler", "sprinkler")}
          </>
        ), { kind: "checks" })}

        {renderDraftGroup("Signals", renderDraftField("Cellular signals", "cellularSignalsRaw", { wide: true }))}

        {renderDraftGroup("Contact", (
          <>
            {renderDraftField("Contact person", "contactPerson")}
            {renderDraftField("Contact number", "contactNumber")}
            {renderDraftField("Other contact information", "otherContactInformation", { wide: true, rows: 3 })}
          </>
        ))}
      </>
    );
  }

  async function searchLocation() {
    const query = locationSearch.trim() || draft.address.trim();

    if (!query) {
      setError("Enter an address or search term before searching the map.");
      return;
    }

    setLocationSearching(true);
    setError(null);

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`
      );

      if (!response.ok) {
        throw new Error("Map search is unavailable right now.");
      }

      const results = (await response.json()) as Array<{ lat: string; lon: string }>;
      const firstResult = results[0];

      if (!firstResult) {
        setError("No map result found for that search.");
        return;
      }

      updateDraftCoordinates({ lat: Number.parseFloat(firstResult.lat), lng: Number.parseFloat(firstResult.lon) });
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Failed to search for that location.");
    } finally {
      setLocationSearching(false);
    }
  }

  function handlePhotoSelection(event: ChangeEvent<HTMLInputElement>) {
    const incomingFiles = Array.from(event.target.files ?? []).filter((file) => file.type.startsWith("image/"));

    if (incomingFiles.length === 0) {
      event.target.value = "";
      return;
    }

    setPendingPhotos((current) => {
      const existing = new Set(current.map((file) => `${file.name}-${file.size}-${file.lastModified}`));
      const next = [...current];

      incomingFiles.forEach((file) => {
        const key = `${file.name}-${file.size}-${file.lastModified}`;
        if (!existing.has(key)) {
          next.push(file);
          existing.add(key);
        }
      });

      return next;
    });

    event.target.value = "";
  }

  function handleEditPhotoSelection(event: ChangeEvent<HTMLInputElement>) {
    const incomingFiles = Array.from(event.target.files ?? []).filter((file) => file.type.startsWith("image/"));

    if (incomingFiles.length === 0) {
      event.target.value = "";
      return;
    }

    setEditPendingPhotos((current) => {
      const existing = new Set(current.map((file) => `${file.name}-${file.size}-${file.lastModified}`));
      const next = [...current];

      incomingFiles.forEach((file) => {
        const key = `${file.name}-${file.size}-${file.lastModified}`;
        if (!existing.has(key)) {
          next.push(file);
          existing.add(key);
        }
      });

      return next;
    });

    event.target.value = "";
  }

  function removePendingPhoto(indexToRemove: number) {
    setPendingPhotos((current) => current.filter((_, index) => index !== indexToRemove));
  }

  function removeEditPendingPhoto(indexToRemove: number) {
    setEditPendingPhotos((current) => current.filter((_, index) => index !== indexToRemove));
  }

  function openPhotoDeleteDialog(photo: ListingPhotoRow) {
    setPhotoDeleteTarget(photo);
    setError(null);
    setFeedback(null);
  }

  function closePhotoDeleteDialog() {
    if (photoActionId) {
      return;
    }

    setPhotoDeleteTarget(null);
  }

  function openArchiveDialog() {
    if (!selectedListing) {
      return;
    }

    setArchiveConfirmOpen(true);
    setArchivePassword("");
    setError(null);
    setFeedback(null);
  }

  function closeArchiveDialog() {
    if (archiving) {
      return;
    }

    setArchiveConfirmOpen(false);
    setArchivePassword("");
  }

  function startPhotoDrag(photoId: string) {
    if (reorderingPhotos) {
      return;
    }

    setDraggedPhotoId(photoId);
    setDragOverPhotoId(photoId);
  }

  function clearPhotoDrag() {
    setDraggedPhotoId(null);
    setDragOverPhotoId(null);
  }

  async function reorderListingPhotos(targetPhotoId: string) {
    const client = supabase;
    if (!client || !selectedListing || !draggedPhotoId || draggedPhotoId === targetPhotoId) {
      clearPhotoDrag();
      return;
    }

    const orderedPhotos = [...selectedListingPhotos];
    const draggedIndex = orderedPhotos.findIndex((photo) => photo.id === draggedPhotoId);
    const targetIndex = orderedPhotos.findIndex((photo) => photo.id === targetPhotoId);

    if (draggedIndex === -1 || targetIndex === -1) {
      clearPhotoDrag();
      return;
    }

    const reorderedPhotos = [...orderedPhotos];
    const [draggedPhoto] = reorderedPhotos.splice(draggedIndex, 1);
    reorderedPhotos.splice(targetIndex, 0, draggedPhoto);

    setReorderingPhotos(true);
    setError(null);
    setFeedback(null);

    try {
      for (const [index, photo] of reorderedPhotos.entries()) {
        const { error: updateError } = await ((client.from("listing_photos") as any)
          .update({ sort_order: index })
          .eq("id", photo.id));

        if (updateError) {
          throw updateError;
        }
      }

      setFeedback(`Updated the photo order for ${selectedListing.name}.`);
      await loadDashboard(selectedListing.id);
    } catch (reorderError) {
      setError(reorderError instanceof Error ? reorderError.message : "Failed to reorder photos.");
    } finally {
      setReorderingPhotos(false);
      clearPhotoDrag();
    }
  }
  async function uploadListingPhotos(
    listingId: string,
    listingName: string,
    files: File[],
    startSortOrder = 0,
    assignFirstAsCover = false
  ) {
    const client = supabase;
    if (!client || files.length === 0) {
      return 0;
    }

    const photoRows = [];
    const uploadStamp = Date.now();

    for (const [index, file] of files.entries()) {
      const optimizedFile = await compressImageForUpload(file);
      const extension = file.name.includes(".")
        ? optimizedFile.name.split(".").pop()?.toLowerCase() || "jpg"
        : "jpg";
      const fileStem = slugifyPathSegment(optimizedFile.name.replace(/\.[^.]+$/, "")) || `photo-${index + 1}`;
      const listingStem = slugifyPathSegment(listingName) || "listing";
      const uniqueId = typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID().slice(0, 8)
        : `${uploadStamp}-${index + 1}`;
      const storagePath = `admin/${listingId}/${uploadStamp}-${index + 1}-${listingStem}-${uniqueId}-${fileStem}.${extension}`;

      const { error: uploadError } = await client.storage.from(listingPhotosBucket).upload(storagePath, optimizedFile, {
        cacheControl: "3600",
        upsert: false,
        contentType: optimizedFile.type || undefined,
      });

      if (uploadError) {
        throw uploadError;
      }

      photoRows.push({
        listing_id: listingId,
        storage_bucket: listingPhotosBucket,
        storage_path: storagePath,
        caption: file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "),
        alt_text: `${listingName} photo ${startSortOrder + index + 1}`,
        sort_order: startSortOrder + index,
        is_cover: assignFirstAsCover && index === 0,
      });
    }

    const { error: photoInsertError } = await ((client.from("listing_photos") as any).insert(photoRows));

    if (photoInsertError) {
      throw photoInsertError;
    }

    return photoRows.length;
  }

  async function saveDraft() {
    const client = supabase;
    if (!client) {
      setError("Supabase is not configured.");
      return;
    }

    if (!draft.name.trim() || !draft.address.trim()) {
      setError("Name and address are required.");
      return;
    }

    setSaving(true);
    setError(null);
    setFeedback(null);

    try {
      const payload = draftToListingPayload(draft);

      if (section === "add") {
        const { data, error: insertError } = await ((client.from("listings") as any)
          .insert({ ...payload, status: "active" })
          .select("id, name")
          .single());

        if (insertError) {
          throw insertError;
        }

        const createdListing = data as { id: string; name: string };
        const uploadedPhotoCount = pendingPhotos.length > 0
          ? await uploadListingPhotos(createdListing.id, createdListing.name, pendingPhotos, 0, true)
          : 0;

        setFeedback(
          uploadedPhotoCount > 0
            ? `Created ${createdListing.name} with ${uploadedPhotoCount} photo(s).`
            : `Created ${createdListing.name}.`
        );
        await loadDashboard(createdListing.id);
        setPendingPhotos([]);
        setSection("edit");
      } else if (section === "edit" && selectedListing) {
        if (selectedListing.status !== "active") {
          setError("Archived listings cannot be edited from this page. Restore it first from the archive section.");
          await loadDashboard();
          return;
        }

        const { error: updateError } = await ((client.from("listings") as any)
          .update(payload)
          .eq("status", "active")
          .eq("id", selectedListing.id));

        if (updateError) {
          throw updateError;
        }

        setFeedback(`Saved updates for ${selectedListing.name}.`);
        await loadDashboard(selectedListing.id);
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save listing.");
    } finally {
      setSaving(false);
    }
  }

  async function addPhotosToSelectedListing() {
    const client = supabase;
    if (!client || !selectedListing || editPendingPhotos.length === 0) {
      return;
    }

    setUploadingPhotos(true);
    setError(null);
    setFeedback(null);

    try {
      const uploadedPhotoCount = await uploadListingPhotos(
        selectedListing.id,
        selectedListing.name,
        editPendingPhotos,
        selectedListingPhotos.length,
        selectedListingPhotos.every((photo) => !photo.is_cover)
      );

      setFeedback(`Added ${uploadedPhotoCount} photo(s) to ${selectedListing.name}.`);
      setEditPendingPhotos([]);
      await loadDashboard(selectedListing.id);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Failed to upload photos.");
    } finally {
      setUploadingPhotos(false);
    }
  }

  async function setCoverPhoto(photoId: string) {
    const client = supabase;
    if (!client || !selectedListing) {
      return;
    }

    setPhotoActionId(photoId);
    setError(null);
    setFeedback(null);

    try {
      const { error: resetCoverError } = await ((client.from("listing_photos") as any)
        .update({ is_cover: false })
        .eq("listing_id", selectedListing.id));

      if (resetCoverError) {
        throw resetCoverError;
      }

      const { error: setCoverError } = await ((client.from("listing_photos") as any)
        .update({ is_cover: true })
        .eq("id", photoId));

      if (setCoverError) {
        throw setCoverError;
      }

      setFeedback(`Updated the cover photo for ${selectedListing.name}.`);
      await loadDashboard(selectedListing.id);
    } catch (coverError) {
      setError(coverError instanceof Error ? coverError.message : "Failed to update the cover photo.");
    } finally {
      setPhotoActionId(null);
    }
  }
  async function removeListingPhoto(photo: ListingPhotoRow) {
    const client = supabase;
    if (!client || !selectedListing) {
      return;
    }

    setPhotoActionId(photo.id);
    setError(null);
    setFeedback(null);

    try {
      const remainingPhotos = selectedListingPhotos.filter((item) => item.id !== photo.id);
      const { error: deleteError } = await ((client.from("listing_photos") as any)
        .delete()
        .eq("id", photo.id));

      if (deleteError) {
        throw deleteError;
      }

      if (photo.storage_path) {
        const { error: storageError } = await client.storage
          .from(photo.storage_bucket || listingPhotosBucket)
          .remove([photo.storage_path]);

        if (storageError) {
          console.warn(storageError);
        }
      }

      if (photo.is_cover && remainingPhotos.length > 0) {
        const { error: nextCoverError } = await ((client.from("listing_photos") as any)
          .update({ is_cover: true })
          .eq("id", remainingPhotos[0].id));

        if (nextCoverError) {
          throw nextCoverError;
        }
      }

      setFeedback(`Removed a photo from ${selectedListing.name}.`);
      await loadDashboard(selectedListing.id);
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Failed to remove the photo.");
    } finally {
      setPhotoActionId(null);
      setPhotoDeleteTarget(null);
    }
  }

  async function archiveSelected() {
    const client = supabase;
    if (!client || !selectedListing) {
      return;
    }

    if (!profile.email) {
      setError("The current admin profile does not have an email address.");
      return;
    }

    const password = archivePassword.trim();
    if (!password) {
      setError("Enter your admin password before archiving this listing.");
      return;
    }

    setArchiving(true);
    setError(null);
    setFeedback(null);

    try {
      const { error: authError } = await client.auth.signInWithPassword({
        email: profile.email,
        password,
      });

      if (authError) {
        throw authError;
      }

      const { error: archiveError } = await ((client.rpc as any)("archive_listing", {
        p_listing_id: selectedListing.id,
        p_delete_reason: "Archived from MAPAGUAPA admin dashboard.",
      }));

      if (archiveError) {
        throw archiveError;
      }

      setFeedback(`${selectedListing.name} was archived.`);
      await loadDashboard();
      setSection("archive");
      setArchiveConfirmOpen(false);
      setArchivePassword("");
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : "Failed to archive listing.");
    } finally {
      setArchiving(false);
    }
  }

  async function restoreArchivedListing(item: DeletedListingRow) {
    const client = supabase;
    if (!client) {
      setError("Supabase is not configured.");
      return;
    }

    setRestoringArchiveId(item.id);
    setError(null);
    setFeedback(null);

    try {
      const { error: restoreError } = await ((client.rpc as any)("restore_listing", {
        p_listing_id: item.original_listing_id,
      }));

      if (restoreError) {
        throw restoreError;
      }

      setFeedback(`${item.listing_name} was restored to active listings.`);
      await loadDashboard(item.original_listing_id);
      setSection("edit");
    } catch (restoreError) {
      setError(restoreError instanceof Error ? restoreError.message : "Failed to restore listing.");
    } finally {
      setRestoringArchiveId(null);
    }
  }

  async function toggleUserActive(user: Profile) {
    const client = supabase;
    if (!client) {
      setError("Supabase is not configured.");
      return;
    }

    if (user.id === profile.id && user.is_active) {
      setError("You cannot deactivate your own admin account while signed in.");
      return;
    }

    setUserActionId(user.id);
    setError(null);
    setFeedback(null);

    try {
      const { error: updateError } = await ((client.from("profiles") as any)
        .update({ is_active: !user.is_active })
        .eq("id", user.id));

      if (updateError) {
        throw updateError;
      }

      setFeedback(`${user.full_name || user.email || "User"} is now ${user.is_active ? "inactive" : "active"}.`);
      await loadDashboard(selectedListing?.id);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Failed to update the user.");
    } finally {
      setUserActionId(null);
    }
  }

  async function toggleUserRole(user: Profile) {
    const client = supabase;
    if (!client) {
      setError("Supabase is not configured.");
      return;
    }

    if (user.id === profile.id && user.role === "admin") {
      setError("You cannot remove your own admin role while signed in.");
      return;
    }

    const nextRole = user.role === "admin" ? "user" : "admin";
    setUserActionId(user.id);
    setError(null);
    setFeedback(null);

    try {
      const { error: updateError } = await ((client.from("profiles") as any)
        .update({ role: nextRole })
        .eq("id", user.id));

      if (updateError) {
        throw updateError;
      }

      setFeedback(`${user.full_name || user.email || "User"} is now ${nextRole === "admin" ? "an admin" : "a user"}.`);
      await loadDashboard(selectedListing?.id);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Failed to update the user role.");
    } finally {
      setUserActionId(null);
    }
  }

  return (
    <main
      className="mapa-admin-page"
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onPointerMove={handlePointerMove}
      ref={pageRef}
    >
      <div className="mapa-admin-page__orb mapa-admin-page__orb--left" />
      <div className="mapa-admin-page__orb mapa-admin-page__orb--right" />
      <div className="mapa-admin-page__orb mapa-admin-page__orb--bottom" />
      <div className="mapa-admin-page__arc mapa-admin-page__arc--left" />
      <div className="mapa-admin-page__arc mapa-admin-page__arc--right" />
      <div className="mapa-admin-page__grid" />
      <div className="mapa-admin-page__mouse-glow" />
      <div className="mapa-admin-page__mouse-warp" />

      <div className="mapa-admin-page__shell">
        {isAdminMenuOpen && (
          <button
            aria-label="Close admin menu"
            className="mapa-admin-page__mobile-menu-backdrop"
            onClick={() => setIsAdminMenuOpen(false)}
            type="button"
          />
        )}

        <aside className={`mapa-admin-page__sidebar mapa-admin-page__fade-up${isAdminMenuOpen ? " is-open" : ""}`}>
          <div className="mapa-admin-page__mobile-sidebar-bar">
            <div className="mapa-admin-page__brand-row">
              <div className="mapa-admin-page__brand-icon">
                <HouseMark className="mapa-admin-page__house-icon" />
              </div>
              <div>
                <p className="mapa-admin-page__eyebrow mapa-admin-page__brand-wordmark">MAPAGUAPA</p>
                <span className="mapa-admin-page__mobile-section-label">{activeSectionCopy.label}</span>
              </div>
            </div>
            <button
              aria-expanded={isAdminMenuOpen}
              aria-label="Open admin menu"
              className="mapa-admin-page__mobile-menu-button"
              onClick={() => setIsAdminMenuOpen((current) => !current)}
              type="button"
            >
              <span />
              <span />
              <span />
            </button>
          </div>

          <div className="mapa-admin-page__sidebar-drawer">
            <div className="mapa-admin-page__sidebar-top">
              <div className="mapa-admin-page__brand-box">
              <div className="mapa-admin-page__brand-row">
                <div className="mapa-admin-page__brand-icon">
                  <HouseMark className="mapa-admin-page__house-icon" />
                </div>
                <p className="mapa-admin-page__eyebrow mapa-admin-page__brand-wordmark">MAPAGUAPA</p>
              </div>
              <h1 className="mapa-admin-page__brand-title">Admin dashboard</h1>
            </div>

            <div className="mapa-admin-page__profile-card">
              <p className="mapa-admin-page__panel-kicker">Signed in as</p>
              <h2 className="mapa-admin-page__profile-name">{profile.full_name || profile.email || "Admin"}</h2>
              <p className="mapa-admin-page__profile-email">{profile.email}</p>
              <div className="mapa-admin-page__profile-meta">
                <span className="mapa-admin-page__pill">{profile.role}</span>
                <span className="mapa-admin-page__pill">{profile.is_active ? "Active" : "Inactive"}</span>
              </div>
            </div>
            </div>

            <nav className="mapa-admin-page__nav">
              {sidebarItems.map((item) => (
                <button
                  className={`mapa-admin-page__nav-item${section === item.id ? " is-active" : ""}`}
                  key={item.id}
                  onClick={() => openSection(item.id)}
                  type="button"
                >
                  <div>
                    <span className="mapa-admin-page__nav-label">{item.label}</span>
                    <span className="mapa-admin-page__nav-caption">{item.caption}</span>
                  </div>
                  {item.badge && <span className="mapa-admin-page__nav-badge">{item.badge}</span>}
                </button>
              ))}
            </nav>

            <div className="mapa-admin-page__sidebar-footer">
              <button className="mapa-admin-page__logout-button" onClick={() => void onSignOut()} type="button">
                Log out
              </button>
            </div>
          </div>
        </aside>

        <section className="mapa-admin-page__workspace mapa-admin-page__fade-up mapa-admin-page__fade-up--delay-1">
          <header className="mapa-admin-page__workspace-header">
            <div>
              <p className="mapa-admin-page__workspace-kicker">{activeSectionCopy.label}</p>
              <h2 className="mapa-admin-page__workspace-title">{activeSectionCopy.title}</h2>
              <p className="mapa-admin-page__workspace-copy">{activeSectionCopy.description}</p>
            </div>
            <div className="mapa-admin-page__workspace-actions">
              <button className="mapa-admin-page__action mapa-admin-page__action--ghost" onClick={() => void loadDashboard(selectedListing?.id)} type="button">
                Refresh
              </button>
              {section === "edit" && selectedListing && (
                <button className="mapa-admin-page__action mapa-admin-page__action--danger" disabled={archiving} onClick={openArchiveDialog} type="button">
                  {archiving ? "Archiving..." : "Archive listing"}
                </button>
              )}
            </div>
          </header>

          {feedback && <p className="mapa-admin-page__feedback mapa-admin-page__feedback--info">{feedback}</p>}
          {error && <p className="mapa-admin-page__feedback mapa-admin-page__feedback--error">{error}</p>}
          {loading && <p className="mapa-admin-page__feedback">Loading dashboard data...</p>}

          <div className="mapa-admin-page__workspace-frame">
            {section === "overview" && !loading && (
              <div className="mapa-admin-page__overview-grid">
                <section className="mapa-admin-page__stats-grid">
                  <article className="mapa-admin-page__stat-card">
                    <p className="mapa-admin-page__panel-kicker">Active listings</p>
                    <h3 className="mapa-admin-page__stat-value">{listings.length.toString().padStart(2, "0")}</h3>
                    <p className="mapa-admin-page__card-copy">Listings visible to student users.</p>
                  </article>
                  <article className="mapa-admin-page__stat-card">
                    <p className="mapa-admin-page__panel-kicker">Photo records</p>
                    <h3 className="mapa-admin-page__stat-value">{totalPhotos.toString().padStart(2, "0")}</h3>
                    <p className="mapa-admin-page__card-copy">Images connected through listing_photos.</p>
                  </article>
                  <article className="mapa-admin-page__stat-card">
                    <p className="mapa-admin-page__panel-kicker">Archived</p>
                    <h3 className="mapa-admin-page__stat-value">{deletedListings.length.toString().padStart(2, "0")}</h3>
                    <p className="mapa-admin-page__card-copy">Records preserved after delete actions.</p>
                  </article>
                  <article className="mapa-admin-page__stat-card">
                    <p className="mapa-admin-page__panel-kicker">Total users</p>
                    <h3 className="mapa-admin-page__stat-value">{users.length.toString().padStart(2, "0")}</h3>
                    <p className="mapa-admin-page__card-copy">{totalAdmins} admin account(s) currently registered.</p>
                  </article>
                </section>

                <div className="mapa-admin-page__overview-panels">
                  <section className="mapa-admin-page__section-card">
                    <div className="mapa-admin-page__section-head">
                      <div>
                        <p className="mapa-admin-page__panel-kicker">Recent listings</p>
                        <h3 className="mapa-admin-page__section-title">Quick access to active records</h3>
                      </div>
                    </div>
                    <div className="mapa-admin-page__list-stack">
                      {recentListings.map((listing) => (
                        <button className="mapa-admin-page__compact-card" key={listing.id} onClick={() => openListingEditor(listing.id)} type="button">
                          <div>
                            <h4 className="mapa-admin-page__compact-title">{listing.name}</h4>
                            <p className="mapa-admin-page__compact-copy">{listing.address}</p>
                          </div>
                          <span className="mapa-admin-page__nav-badge">{formatPesoLabel(listing.monthly_rental_label)}</span>
                        </button>
                      ))}
                    </div>
                  </section>

                  <section className="mapa-admin-page__section-card">
                    <div className="mapa-admin-page__section-head">
                      <div>
                        <p className="mapa-admin-page__panel-kicker">Guardrails</p>
                        <h3 className="mapa-admin-page__section-title">Admin actions and archive rules</h3>
                      </div>
                    </div>
                    <div className="mapa-admin-page__rule-stack">
                      {checklist.map((item) => (
                        <div className="mapa-admin-page__rule-item" key={item}>
                          <span className="mapa-admin-page__rule-dot" />
                          <p>{item}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              </div>
            )}

            {section === "add" && !loading && (
              <div className="mapa-admin-page__form-layout">
                <section className="mapa-admin-page__section-card mapa-admin-page__section-card--form">
                  <div className="mapa-admin-page__section-head">
                    <div>
                      <p className="mapa-admin-page__panel-kicker">Add listing</p>
                      <h3 className="mapa-admin-page__section-title">Listing information</h3>
                    </div>
                  </div>
                  {renderListingDraftFields()}
                  <div className="mapa-admin-page__location-picker">
                    <div className="mapa-admin-page__location-head">
                      <div>
                        <p className="mapa-admin-page__panel-kicker">Property location</p>
                        <h4 className="mapa-admin-page__compact-title">Pinpoint the exact map position</h4>
                        <p className="mapa-admin-page__card-copy">Search by address, then click or drag the marker to fine-tune the saved coordinates.</p>
                      </div>
                      {getDraftCoordinates(draft) && (
                        <span className="mapa-admin-page__nav-badge">
                          {Number.parseFloat(draft.locationLat).toFixed(4)}, {Number.parseFloat(draft.locationLng).toFixed(4)}
                        </span>
                      )}
                    </div>
                    <div className="mapa-admin-page__location-search">
                      <input
                        onChange={(event) => setLocationSearch(event.target.value)}
                        placeholder="Search an address or landmark"
                        type="text"
                        value={locationSearch}
                      />
                      <button className="mapa-admin-page__action mapa-admin-page__action--ghost" disabled={locationSearching} onClick={() => void searchLocation()} type="button">
                        {locationSearching ? "Searching..." : "Search map"}
                      </button>
                    </div>
                    <PropertyMap coordinates={getDraftCoordinates(draft)} mode="picker" onChange={updateDraftCoordinates} />
                  </div>
                  <div className="mapa-admin-page__photo-upload">
                    <div>
                      <p className="mapa-admin-page__panel-kicker">Listing photos</p>
                      <h4 className="mapa-admin-page__compact-title">Upload photos for this new listing</h4>
                      <p className="mapa-admin-page__card-copy">Select one or more images. Large uploads are optimized before they go to storage, and the first photo becomes the cover image after the listing is created.</p>
                    </div>
                    <label className="mapa-admin-page__photo-upload-input">
                      <span>Add photos</span>
                      <input accept="image/*" multiple onChange={handlePhotoSelection} type="file" />
                    </label>
                    {pendingPhotos.length > 0 ? (
                      <div className="mapa-admin-page__photo-upload-list">
                        {pendingPhotos.map((file, index) => (
                          <article className="mapa-admin-page__photo-upload-item" key={`${file.name}-${file.size}-${file.lastModified}`}>
                            <div className="mapa-admin-page__photo-upload-meta">
                              <p className="mapa-admin-page__compact-title">{index === 0 ? `${file.name} (Cover)` : file.name}</p>
                              <p className="mapa-admin-page__compact-copy">{formatFileSize(file.size)}</p>
                            </div>
                            <button className="mapa-admin-page__action mapa-admin-page__action--ghost mapa-admin-page__action--small" onClick={() => removePendingPhoto(index)} type="button">Remove</button>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <p className="mapa-admin-page__card-copy">No photos selected yet.</p>
                    )}
                  </div>
                  <div className="mapa-admin-page__form-actions">
                    <button className="mapa-admin-page__action mapa-admin-page__action--ghost" onClick={() => setShowAddPreview((current) => !current)} type="button">{showAddPreview ? "Hide preview" : "Preview listing"}</button>
                    <button className="mapa-admin-page__action mapa-admin-page__action--ghost" onClick={() => { setDraft({ ...emptyListingDraft }); setPendingPhotos([]); setShowAddPreview(true); }} type="button">Reset</button>
                    <button className="mapa-admin-page__action mapa-admin-page__action--primary" disabled={saving} onClick={() => void saveDraft()} type="button">{saving ? "Creating..." : "Create listing"}</button>
                  </div>
                </section>

                <div className="mapa-admin-page__preview-stack">
                  {showAddPreview && (
                    <section className="mapa-admin-page__section-card">
                      <div className="mapa-admin-page__section-head">
                        <div>
                          <p className="mapa-admin-page__panel-kicker">Preview</p>
                          <h3 className="mapa-admin-page__section-title">Draft listing preview</h3>
                        </div>
                        <span className="mapa-admin-page__nav-badge">{draft.monthlyRentalLabel.trim() ? formatPesoLabel(draft.monthlyRentalLabel) : "Draft"}</span>
                      </div>
                      <article className="mapa-admin-page__preview-card">
                        <div className="mapa-admin-page__preview-copy">
                          <h4 className="mapa-admin-page__section-title">{draft.name.trim() || "Untitled listing"}</h4>
                          <p className="mapa-admin-page__compact-copy">{draft.address.trim() || "Address will appear here once you fill in the form."}</p>
                          <p className="mapa-admin-page__card-copy">{draft.description.trim() || `${draft.accommodationType || "Listing"} in ${draft.address.trim() || "your selected location"} with ${formatPesoLabel(draft.monthlyRentalLabel).toLowerCase()} monthly rent.`}</p>
                          <div className="mapa-admin-page__preview-meta">
                            <span className="mapa-admin-page__pill">{draft.accommodationType.trim() || "Listing"}</span>
                            {draft.exclusivity.trim() && <span className="mapa-admin-page__pill">{draft.exclusivity}</span>}
                            {draft.roomsAvailable.trim() && <span className="mapa-admin-page__pill">{draft.roomsAvailable} room(s)</span>}
                            {pendingPhotos.length > 0 && <span className="mapa-admin-page__pill">{pendingPhotos.length} photo(s) queued</span>}
                          </div>
                        </div>
                      </article>
                    </section>
                  )}
                  <section className="mapa-admin-page__section-card">
                    <div className="mapa-admin-page__section-head">
                      <div>
                        <p className="mapa-admin-page__panel-kicker">Publishing note</p>
                        <h3 className="mapa-admin-page__section-title">What to add next</h3>
                      </div>
                    </div>
                    <div className="mapa-admin-page__rule-stack">
                      <div className="mapa-admin-page__rule-item"><span className="mapa-admin-page__rule-dot" /><p>You can now add photos here before creating the listing.</p></div>
                      <div className="mapa-admin-page__rule-item"><span className="mapa-admin-page__rule-dot" /><p>Selected images upload to the `listing-photos` bucket right after the listing record is created.</p></div>
                      <div className="mapa-admin-page__rule-item"><span className="mapa-admin-page__rule-dot" /><p>Owner contact details here will appear on the student-facing listing details page.</p></div>
                    </div>
                  </section>
                </div>
              </div>
            )}

            {section === "edit" && !loading && (
              <div className="mapa-admin-page__editor-layout">
                <section className="mapa-admin-page__section-card">
                  <div className="mapa-admin-page__section-head">
                    <div>
                      <p className="mapa-admin-page__panel-kicker">Listing directory</p>
                      <h3 className="mapa-admin-page__section-title">Choose a record to manage</h3>
                    </div>
                  </div>
                  <div className="mapa-admin-page__directory-filter">
                    <label className="mapa-admin-page__field">
                      <span>Display area</span>
                      <select onChange={(event) => setActiveEditArea(event.target.value)} value={activeEditArea}>
                        {editAreaOptions.map((area) => (
                          <option key={area} value={area}>
                            {area}
                          </option>
                        ))}
                      </select>
                    </label>
                    <span className="mapa-admin-page__nav-badge">
                      {filteredEditListings.length.toString().padStart(2, "0")} shown
                    </span>
                  </div>
                  <div className="mapa-admin-page__directory-list">
                    {filteredEditListings.length > 0 ? (
                      filteredEditListings.map((listing) => (
                        <button className={`mapa-admin-page__directory-card${selectedListing?.id === listing.id ? " is-selected" : ""}`} key={listing.id} onClick={() => selectListing(listing.id)} type="button">
                          <div>
                            <h4 className="mapa-admin-page__compact-title">{listing.name}</h4>
                            <p className="mapa-admin-page__compact-copy">{listing.address}</p>
                          </div>
                          <span className="mapa-admin-page__nav-badge">{formatPesoLabel(listing.monthly_rental_label)}</span>
                        </button>
                      ))
                    ) : (
                      <p className="mapa-admin-page__feedback">No listings found in {activeEditArea}.</p>
                    )}
                  </div>
                </section>

                <div className="mapa-admin-page__editor-stack">
                  {selectedListing ? (
                    <>
                      <section className="mapa-admin-page__section-card">
                        <div className="mapa-admin-page__section-head">
                          <div>
                            <p className="mapa-admin-page__panel-kicker">Selected listing</p>
                            <h3 className="mapa-admin-page__section-title">{selectedListing.name}</h3>
                            <p className="mapa-admin-page__card-copy">{selectedListing.address}</p>
                          </div>
                          <span className="mapa-admin-page__nav-badge">Row {selectedListing.source_row_number ?? "-"}</span>
                        </div>
                        <div className="mapa-admin-page__feature-preview">
                          <div className="mapa-admin-page__hero-photo" style={getListingCover(selectedListing) ? { backgroundImage: `linear-gradient(rgba(8, 19, 15, 0.14), rgba(8, 19, 15, 0.44)), url(${getListingCover(selectedListing)})` } : undefined} />
                          <div className="mapa-admin-page__mini-photo-grid">
                            {selectedPhotos.length > 0 ? (
                              selectedPhotos.map((photo, index) => {
                                const photoUrl = toPublicPhotoUrl(photo);
                                return (
                                  <article className="mapa-admin-page__mini-photo-card" key={photo.id}>
                                    <div className="mapa-admin-page__mini-photo" style={photoUrl ? { backgroundImage: `linear-gradient(rgba(8, 19, 15, 0.14), rgba(8, 19, 15, 0.44)), url(${photoUrl})` } : undefined} />
                                    <div className="mapa-admin-page__mini-photo-copy">
                                      <p className="mapa-admin-page__mini-photo-name">{photo.caption || photo.alt_text || `Photo ${index + 1}`}</p>
                                      <p className="mapa-admin-page__mini-photo-meta">{photo.is_cover ? "Cover image" : `Gallery photo ${index + 1}`}</p>
                                    </div>
                                  </article>
                                );
                              })
                            ) : (
                              <p className="mapa-admin-page__feedback">No photos linked to this listing yet.</p>
                            )}
                          </div>
                        </div>
                        <div className="mapa-admin-page__detail-grid">
                          <article className="mapa-admin-page__detail-card"><h4 className="mapa-admin-page__compact-title">Property</h4><p>{selectedListing.accommodation_type}{selectedListing.accommodation_type_other ? ` - ${selectedListing.accommodation_type_other}` : ""}</p><p>{selectedListing.exclusivity || "Open"}</p><p>{selectedListing.rooms_available ?? 0} rooms</p><p>{selectedListing.curfew || "No curfew listed"}</p><p>{labelBoolean(selectedListing.is_fenced, "Fenced", "Fence not listed")}</p></article>
                          <article className="mapa-admin-page__detail-card"><h4 className="mapa-admin-page__compact-title">Utilities</h4><p>{selectedListing.bills_included || "No included bills listed"}</p><p>{selectedListing.bills_not_included || "No excluded bills listed"}</p><p>{formatSignals(selectedListing.cellular_signals, selectedListing.cellular_signals_raw)}</p><p>{selectedListing.has_additional_appliance_fee ? selectedListing.appliance_fee_label || "Extra appliance fee applies" : "No extra appliance fee"}</p></article>
                          <article className="mapa-admin-page__detail-card"><h4 className="mapa-admin-page__compact-title">Amenities</h4><p>{labelBoolean(selectedListing.has_wifi, "Wi-Fi available")}</p><p>{labelBoolean(selectedListing.has_study_area, "Study area available")}</p><p>{labelBoolean(selectedListing.has_parking_area, "Parking available")}</p><p>{labelBoolean(selectedListing.has_common_kitchen, "Common kitchen")}</p><p>{selectedListing.other_amenities || "No other amenities listed"}</p></article>
                          <article className="mapa-admin-page__detail-card"><h4 className="mapa-admin-page__compact-title">Safety</h4><p>{labelBoolean(selectedListing.has_security_cctv, "Security/CCTV")}</p><p>{labelBoolean(selectedListing.has_emergency_exit, "Emergency exit")}</p><p>{labelBoolean(selectedListing.has_fire_alarm, "Fire alarm")}</p><p>{labelBoolean(selectedListing.has_fire_extinguisher, "Fire extinguisher")}</p></article>
                          <article className="mapa-admin-page__detail-card"><h4 className="mapa-admin-page__compact-title">Owner contact</h4><p>{selectedListing.contact_person || "No contact person"}</p><p>{selectedListing.contact_number || "No contact number"}</p><p>{selectedListing.other_contact_information || "No extra contact info"}</p></article>
                        </div>
                      </section>

                      <section className="mapa-admin-page__section-card">
                        <div className="mapa-admin-page__section-head">
                          <div>
                            <p className="mapa-admin-page__panel-kicker">Photo manager</p>
                            <h3 className="mapa-admin-page__section-title">Add, replace, and remove listing photos</h3>
                          </div>
                          <span className="mapa-admin-page__nav-badge">{selectedListingPhotos.length} linked</span>
                        </div>
                        <div className="mapa-admin-page__photo-manager">
                          <p className="mapa-admin-page__card-copy">Drag non-cover photos to reorder the gallery. Use Set cover when you want to change the main image.</p>
                          <div className="mapa-admin-page__photo-library">
                            {selectedListingPhotos.length > 0 ? (
                              selectedListingPhotos.map((photo) => {
                                const photoUrl = toPublicPhotoUrl(photo);
                                const isBusy = photoActionId === photo.id;
                                const isDragging = draggedPhotoId === photo.id;
                                const isDropTarget = dragOverPhotoId === photo.id && draggedPhotoId !== photo.id;
                                const canDrag = !photo.is_cover && !reorderingPhotos;
                                return (
                                  <article
                                    className={`mapa-admin-page__photo-library-card${photo.is_cover ? " is-cover" : ""}${isDragging ? " is-dragging" : ""}${isDropTarget ? " is-drop-target" : ""}`}
                                    draggable={canDrag}
                                    key={photo.id}
                                    onDragEnd={clearPhotoDrag}
                                    onDragOver={(event) => {
                                      if (!photo.is_cover && draggedPhotoId && draggedPhotoId !== photo.id) {
                                        event.preventDefault();
                                        setDragOverPhotoId(photo.id);
                                      }
                                    }}
                                    onDragStart={() => startPhotoDrag(photo.id)}
                                    onDrop={(event) => {
                                      event.preventDefault();
                                      if (!photo.is_cover) {
                                        void reorderListingPhotos(photo.id);
                                      }
                                    }}
                                  >
                                    <div className="mapa-admin-page__photo-library-image" style={photoUrl ? { backgroundImage: `linear-gradient(rgba(8, 19, 15, 0.12), rgba(8, 19, 15, 0.34)), url(${photoUrl})` } : undefined} />
                                    <div className="mapa-admin-page__photo-library-copy">
                                      <p className="mapa-admin-page__compact-title">{photo.caption || photo.alt_text || "Listing photo"}</p>
                                      <p className="mapa-admin-page__compact-copy">{photo.is_cover ? "Current cover photo" : reorderingPhotos ? "Updating order..." : `Photo ${photo.sort_order + 1} � Drag to reorder`}</p>
                                    </div>
                                    <div className="mapa-admin-page__photo-library-actions">
                                      <button className="mapa-admin-page__action mapa-admin-page__action--ghost mapa-admin-page__action--small" disabled={photo.is_cover || isBusy || reorderingPhotos} onClick={() => void setCoverPhoto(photo.id)} type="button">{isBusy && !photo.is_cover ? "Updating..." : photo.is_cover ? "Cover photo" : "Set cover"}</button>
                                      <button className="mapa-admin-page__action mapa-admin-page__action--danger mapa-admin-page__action--small" disabled={isBusy || reorderingPhotos} onClick={() => openPhotoDeleteDialog(photo)} type="button">{isBusy ? "Removing..." : "Delete"}</button>
                                    </div>
                                  </article>
                                );
                              })
                            ) : (
                              <p className="mapa-admin-page__feedback">No photos linked yet. Upload a few below to build the gallery.</p>
                            )}
                          </div>

                          <div className="mapa-admin-page__photo-upload">
                            <div>
                              <p className="mapa-admin-page__panel-kicker">Add more photos</p>
                              <h4 className="mapa-admin-page__compact-title">Upload fresh images for this listing</h4>
                              <p className="mapa-admin-page__card-copy">New uploads are optimized before storage, then added to the gallery and can become the cover photo if the listing does not have one yet.</p>
                            </div>
                            <label className="mapa-admin-page__photo-upload-input">
                              <span>Select images</span>
                              <input accept="image/*" multiple onChange={handleEditPhotoSelection} type="file" />
                            </label>
                            {editPendingPhotos.length > 0 ? (
                              <div className="mapa-admin-page__photo-upload-list">
                                {editPendingPhotos.map((file, index) => (
                                  <article className="mapa-admin-page__photo-upload-item" key={`${file.name}-${file.size}-${file.lastModified}`}>
                                    <div className="mapa-admin-page__photo-upload-meta">
                                      <p className="mapa-admin-page__compact-title">{file.name}</p>
                                      <p className="mapa-admin-page__compact-copy">{formatFileSize(file.size)}</p>
                                    </div>
                                    <button className="mapa-admin-page__action mapa-admin-page__action--ghost mapa-admin-page__action--small" onClick={() => removeEditPendingPhoto(index)} type="button">Remove</button>
                                  </article>
                                ))}
                              </div>
                            ) : (
                              <p className="mapa-admin-page__card-copy">No new photos queued yet.</p>
                            )}
                            <div className="mapa-admin-page__form-actions">
                              <button className="mapa-admin-page__action mapa-admin-page__action--primary" disabled={uploadingPhotos || editPendingPhotos.length === 0} onClick={() => void addPhotosToSelectedListing()} type="button">{uploadingPhotos ? "Uploading..." : `Upload ${editPendingPhotos.length > 0 ? editPendingPhotos.length : ""} photo(s)`}</button>
                            </div>
                          </div>
                        </div>
                      </section>

                      <section className="mapa-admin-page__section-card mapa-admin-page__section-card--form">
                        <div className="mapa-admin-page__section-head">
                          <div>
                            <p className="mapa-admin-page__panel-kicker">Edit listing</p>
                            <h3 className="mapa-admin-page__section-title">Update details</h3>
                          </div>
                        </div>
                        {renderListingDraftFields()}
                        <div className="mapa-admin-page__location-picker">
                          <div className="mapa-admin-page__location-head">
                            <div>
                              <p className="mapa-admin-page__panel-kicker">Property location</p>
                              <h4 className="mapa-admin-page__compact-title">Update the map pin</h4>
                              <p className="mapa-admin-page__card-copy">Search by address, then click or drag the marker to fine-tune the saved coordinates.</p>
                            </div>
                            {getDraftCoordinates(draft) && (
                              <span className="mapa-admin-page__nav-badge">
                                {Number.parseFloat(draft.locationLat).toFixed(4)}, {Number.parseFloat(draft.locationLng).toFixed(4)}
                              </span>
                            )}
                          </div>
                          <div className="mapa-admin-page__location-search">
                            <input
                              onChange={(event) => setLocationSearch(event.target.value)}
                              placeholder="Search an address or landmark"
                              type="text"
                              value={locationSearch}
                            />
                            <button className="mapa-admin-page__action mapa-admin-page__action--ghost" disabled={locationSearching} onClick={() => void searchLocation()} type="button">
                              {locationSearching ? "Searching..." : "Search map"}
                            </button>
                          </div>
                          <PropertyMap coordinates={getDraftCoordinates(draft)} mode="picker" onChange={updateDraftCoordinates} />
                        </div>
                        <div className="mapa-admin-page__form-actions">
                          <button className="mapa-admin-page__action mapa-admin-page__action--ghost" onClick={() => { setDraft(listingToDraft(selectedListing)); setEditPendingPhotos([]); }} type="button">Reset</button>
                          <button className="mapa-admin-page__action mapa-admin-page__action--primary" disabled={saving} onClick={() => void saveDraft()} type="button">{saving ? "Saving..." : "Save changes"}</button>
                        </div>
                      </section>
                    </>
                  ) : (
                    <p className="mapa-admin-page__feedback">No listing is available to edit yet.</p>
                  )}
                </div>
              </div>
            )}

            {section === "archive" && !loading && (
              <div className="mapa-admin-page__two-column-layout">
                <section className="mapa-admin-page__section-card">
                  <div className="mapa-admin-page__section-head">
                    <div>
                      <p className="mapa-admin-page__panel-kicker">Archived listings</p>
                      <h3 className="mapa-admin-page__section-title">Removed records</h3>
                    </div>
                  </div>
                  <div className="mapa-admin-page__list-stack">
                    {deletedListings.length > 0 ? (
                      deletedListings.map((item) => (
                        <article className="mapa-admin-page__compact-card mapa-admin-page__compact-card--static" key={item.id}>
                          <div>
                            <h4 className="mapa-admin-page__compact-title">{item.listing_name}</h4>
                            <p className="mapa-admin-page__compact-copy">{item.delete_reason || "No archive reason provided."}</p>
                          </div>
                          <div className="mapa-admin-page__compact-actions">
                            <span className="mapa-admin-page__nav-badge">{new Date(item.deleted_at).toLocaleDateString()}</span>
                            <button
                              className="mapa-admin-page__action mapa-admin-page__action--ghost mapa-admin-page__action--small"
                              disabled={restoringArchiveId === item.id}
                              onClick={() => void restoreArchivedListing(item)}
                              type="button"
                            >
                              {restoringArchiveId === item.id ? "Restoring..." : "Restore"}
                            </button>
                          </div>
                        </article>
                      ))
                    ) : (
                      <p className="mapa-admin-page__feedback">No archived listings yet.</p>
                    )}
                  </div>
                </section>

                <section className="mapa-admin-page__section-card">
                  <div className="mapa-admin-page__section-head">
                    <div>
                      <p className="mapa-admin-page__panel-kicker">Archive flow</p>
                      <h3 className="mapa-admin-page__section-title">What happens on delete</h3>
                    </div>
                  </div>
                  <div className="mapa-admin-page__rule-stack">
                    <div className="mapa-admin-page__rule-item"><span className="mapa-admin-page__rule-dot" /><p>The admin re-enters the password before the delete proceeds.</p></div>
                    <div className="mapa-admin-page__rule-item"><span className="mapa-admin-page__rule-dot" /><p>The listing is archived through `public.archive_listing()` instead of being hard-deleted.</p></div>
                    <div className="mapa-admin-page__rule-item"><span className="mapa-admin-page__rule-dot" /><p>Students stop seeing the listing, but the snapshot stays available for admin review.</p></div>
                  </div>
                </section>
              </div>
            )}

            {section === "users" && !loading && (
              <div className="mapa-admin-page__users-layout">
                <section className="mapa-admin-page__stats-grid mapa-admin-page__stats-grid--users">
                  <article className="mapa-admin-page__stat-card">
                    <p className="mapa-admin-page__panel-kicker">Total users</p>
                    <h3 className="mapa-admin-page__stat-value">{users.length.toString().padStart(2, "0")}</h3>
                    <p className="mapa-admin-page__card-copy">All profiles currently in the database.</p>
                  </article>
                  <article className="mapa-admin-page__stat-card">
                    <p className="mapa-admin-page__panel-kicker">Admins</p>
                    <h3 className="mapa-admin-page__stat-value">{totalAdmins.toString().padStart(2, "0")}</h3>
                    <p className="mapa-admin-page__card-copy">Accounts with admin dashboard access.</p>
                  </article>
                  <article className="mapa-admin-page__stat-card">
                    <p className="mapa-admin-page__panel-kicker">Active accounts</p>
                    <h3 className="mapa-admin-page__stat-value">{users.filter((user) => user.is_active).length.toString().padStart(2, "0")}</h3>
                    <p className="mapa-admin-page__card-copy">Profiles currently marked as active.</p>
                  </article>
                </section>

                <section className="mapa-admin-page__section-card">
                  <div className="mapa-admin-page__section-head">
                    <div>
                      <p className="mapa-admin-page__panel-kicker">User directory</p>
                      <h3 className="mapa-admin-page__section-title">Profiles and roles</h3>
                    </div>
                  </div>
                  <div className="mapa-admin-page__user-list">
                    {users.map((user) => (
                      <article className="mapa-admin-page__user-row" key={user.id}>
                        <div>
                          <h4 className="mapa-admin-page__compact-title">{user.full_name || user.email || "Unnamed user"}</h4>
                          <p className="mapa-admin-page__compact-copy">{user.email || "No email"}</p>
                        </div>
                        <div className="mapa-admin-page__user-meta">
                          <span className="mapa-admin-page__pill">{user.role}</span>
                          <span className="mapa-admin-page__pill">{user.is_active ? "Active" : "Inactive"}</span>
                          <button
                            className="mapa-admin-page__action mapa-admin-page__action--ghost mapa-admin-page__action--small"
                            disabled={userActionId === user.id}
                            onClick={() => void toggleUserActive(user)}
                            type="button"
                          >
                            {userActionId === user.id ? "Updating..." : user.is_active ? "Deactivate" : "Activate"}
                          </button>
                          <button
                            className="mapa-admin-page__action mapa-admin-page__action--ghost mapa-admin-page__action--small"
                            disabled={userActionId === user.id}
                            onClick={() => void toggleUserRole(user)}
                            type="button"
                          >
                            {user.role === "admin" ? "Make user" : "Make admin"}
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              </div>
            )}
          </div>
        </section>
      </div>

      {archiveConfirmOpen && selectedListing ? (
        <div className="mapa-admin-page__dialog-backdrop" onClick={closeArchiveDialog} role="presentation">
          <div
            aria-labelledby="mapa-admin-archive-title"
            aria-modal="true"
            className="mapa-admin-page__dialog"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <p className="mapa-admin-page__panel-kicker">Archive listing</p>
            <h3 className="mapa-admin-page__dialog-title" id="mapa-admin-archive-title">
              Archive {selectedListing.name}?
            </h3>
            <p className="mapa-admin-page__card-copy">
              This removes the listing from the student catalog and stores an archive record. Enter your admin password to continue.
            </p>
            <label className="mapa-admin-page__field">
              <span>Admin password</span>
              <input
                autoComplete="current-password"
                onChange={(event) => setArchivePassword(event.target.value)}
                type="password"
                value={archivePassword}
              />
            </label>
            <div className="mapa-admin-page__form-actions mapa-admin-page__dialog-actions">
              <button className="mapa-admin-page__action mapa-admin-page__action--ghost" disabled={archiving} onClick={closeArchiveDialog} type="button">
                Cancel
              </button>
              <button className="mapa-admin-page__action mapa-admin-page__action--danger" disabled={archiving} onClick={() => void archiveSelected()} type="button">
                {archiving ? "Archiving..." : "Archive listing"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {photoDeleteTarget && selectedListing ? (
        <div className="mapa-admin-page__dialog-backdrop" onClick={closePhotoDeleteDialog} role="presentation">
          <div
            aria-labelledby="mapa-admin-photo-delete-title"
            aria-modal="true"
            className="mapa-admin-page__dialog"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <p className="mapa-admin-page__panel-kicker">Delete photo</p>
            <h3 className="mapa-admin-page__dialog-title" id="mapa-admin-photo-delete-title">
              Remove this image from {selectedListing.name}?
            </h3>
            <p className="mapa-admin-page__card-copy">
              {photoDeleteTarget.caption || photoDeleteTarget.alt_text || "This photo"} will be removed from the gallery and deleted from storage.
              {photoDeleteTarget.is_cover ? " The next available image will become the cover photo." : ""}
            </p>
            <div
              className="mapa-admin-page__dialog-preview"
              style={toPublicPhotoUrl(photoDeleteTarget) ? { backgroundImage: `linear-gradient(rgba(8, 19, 15, 0.14), rgba(8, 19, 15, 0.42)), url(${toPublicPhotoUrl(photoDeleteTarget)})` } : undefined}
            />
            <div className="mapa-admin-page__form-actions mapa-admin-page__dialog-actions">
              <button className="mapa-admin-page__action mapa-admin-page__action--ghost" disabled={photoActionId === photoDeleteTarget.id} onClick={closePhotoDeleteDialog} type="button">
                Keep photo
              </button>
              <button className="mapa-admin-page__action mapa-admin-page__action--danger" disabled={photoActionId === photoDeleteTarget.id} onClick={() => void removeListingPhoto(photoDeleteTarget)} type="button">
                {photoActionId === photoDeleteTarget.id ? "Deleting..." : "Delete photo"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}



