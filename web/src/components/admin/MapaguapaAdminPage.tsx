import { useEffect, useMemo, useState, type ChangeEvent } from "react";
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
import { listingPhotosBucket, supabase } from "../../lib/supabase";
import HouseMark from "../shared/HouseMark";
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

export default function MapaguapaAdminPage({ onSignOut, profile }: MapaguapaAdminPageProps) {
  const [section, setSection] = useState<AdminSection>("overview");
  const [listings, setListings] = useState<ListingWithPhotos[]>([]);
  const [deletedListings, setDeletedListings] = useState<DeletedListingRow[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [selectedListingId, setSelectedListingId] = useState("");
  const [draft, setDraft] = useState<ListingDraft>({ ...emptyListingDraft });
  const [pendingPhotos, setPendingPhotos] = useState<File[]>([]);
  const [editPendingPhotos, setEditPendingPhotos] = useState<File[]>([]);
  const [showAddPreview, setShowAddPreview] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [photoActionId, setPhotoActionId] = useState<string | null>(null);
  const [draggedPhotoId, setDraggedPhotoId] = useState<string | null>(null);
  const [dragOverPhotoId, setDragOverPhotoId] = useState<string | null>(null);
  const [reorderingPhotos, setReorderingPhotos] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { pageRef, handlePointerEnter, handlePointerLeave, handlePointerMove } = usePointerGlow({
    centerXRatio: 0.68,
    centerYRatio: 0.42,
  });

  const selectedListing = useMemo(
    () => listings.find((listing) => listing.id === selectedListingId) ?? listings[0] ?? null,
    [listings, selectedListingId]
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
      const extension = file.name.includes(".")
        ? file.name.split(".").pop()?.toLowerCase() || "jpg"
        : "jpg";
      const fileStem = slugifyPathSegment(file.name.replace(/\.[^.]+$/, "")) || `photo-${index + 1}`;
      const listingStem = slugifyPathSegment(listingName) || "listing";
      const uniqueId = typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID().slice(0, 8)
        : `${uploadStamp}-${index + 1}`;
      const storagePath = `admin/${listingId}/${uploadStamp}-${index + 1}-${listingStem}-${uniqueId}-${fileStem}.${extension}`;

      const { error: uploadError } = await client.storage.from(listingPhotosBucket).upload(storagePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || undefined,
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
          .insert(payload)
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
        const { error: updateError } = await ((client.from("listings") as any)
          .update(payload)
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

    const confirmed = window.confirm(`Remove ${photo.caption || photo.alt_text || "this photo"} from ${selectedListing.name}?`);
    if (!confirmed) {
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

    const password = window.prompt(`Re-enter the admin password to archive ${selectedListing.name}.`);
    if (!password) {
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
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : "Failed to archive listing.");
    } finally {
      setArchiving(false);
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
        <aside className="mapa-admin-page__sidebar mapa-admin-page__fade-up">
          <div className="mapa-admin-page__sidebar-top">
            <div className="mapa-admin-page__brand-box">
              <div className="mapa-admin-page__brand-icon">
                <HouseMark className="mapa-admin-page__house-icon" />
              </div>
              <div>
                <p className="mapa-admin-page__eyebrow">MAPAGUAPA</p>
                <h1 className="mapa-admin-page__brand-title">Admin dashboard</h1>
              </div>
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
                <button className="mapa-admin-page__action mapa-admin-page__action--danger" disabled={archiving} onClick={() => void archiveSelected()} type="button">
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
                          <span className="mapa-admin-page__nav-badge">{listing.monthly_rental_label}</span>
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
                  <div className="mapa-admin-page__field-grid">
                    <label className="mapa-admin-page__field"><span>Accommodation name</span><input onChange={(event) => updateDraft("name", event.target.value)} type="text" value={draft.name} /></label>
                    <label className="mapa-admin-page__field"><span>Address</span><input onChange={(event) => updateDraft("address", event.target.value)} type="text" value={draft.address} /></label>
                    <label className="mapa-admin-page__field"><span>Accommodation type</span><input onChange={(event) => updateDraft("accommodationType", event.target.value)} type="text" value={draft.accommodationType} /></label>
                    <label className="mapa-admin-page__field"><span>Exclusivity</span><input onChange={(event) => updateDraft("exclusivity", event.target.value)} type="text" value={draft.exclusivity} /></label>
                    <label className="mapa-admin-page__field"><span>Monthly rental</span><input onChange={(event) => updateDraft("monthlyRentalLabel", event.target.value)} type="text" value={draft.monthlyRentalLabel} /></label>
                    <label className="mapa-admin-page__field"><span>Rooms available</span><input onChange={(event) => updateDraft("roomsAvailable", event.target.value)} type="text" value={draft.roomsAvailable} /></label>
                    <label className="mapa-admin-page__field"><span>Floors</span><input onChange={(event) => updateDraft("floorsLabel", event.target.value)} type="text" value={draft.floorsLabel} /></label>
                    <label className="mapa-admin-page__field"><span>Occupancy</span><input onChange={(event) => updateDraft("occupancyLabel", event.target.value)} type="text" value={draft.occupancyLabel} /></label>
                    <label className="mapa-admin-page__field"><span>Curfew</span><input onChange={(event) => updateDraft("curfew", event.target.value)} type="text" value={draft.curfew} /></label>
                    <label className="mapa-admin-page__field"><span>Signals</span><input onChange={(event) => updateDraft("cellularSignalsRaw", event.target.value)} type="text" value={draft.cellularSignalsRaw} /></label>
                    <label className="mapa-admin-page__field"><span>Contact person</span><input onChange={(event) => updateDraft("contactPerson", event.target.value)} type="text" value={draft.contactPerson} /></label>
                    <label className="mapa-admin-page__field"><span>Contact number</span><input onChange={(event) => updateDraft("contactNumber", event.target.value)} type="text" value={draft.contactNumber} /></label>
                    <label className="mapa-admin-page__field mapa-admin-page__field--wide"><span>Other contact information</span><textarea onChange={(event) => updateDraft("otherContactInformation", event.target.value)} rows={3} value={draft.otherContactInformation} /></label>
                    <label className="mapa-admin-page__field mapa-admin-page__field--wide"><span>Description</span><textarea onChange={(event) => updateDraft("description", event.target.value)} rows={4} value={draft.description} /></label>
                  </div>
                  <div className="mapa-admin-page__checkbox-grid">
                    <label className="mapa-admin-page__checkbox"><input checked={draft.utilitiesIncluded} onChange={(event) => updateDraft("utilitiesIncluded", event.target.checked)} type="checkbox" /><span>Utilities included</span></label>
                    <label className="mapa-admin-page__checkbox"><input checked={draft.wifi} onChange={(event) => updateDraft("wifi", event.target.checked)} type="checkbox" /><span>Wi-Fi available</span></label>
                    <label className="mapa-admin-page__checkbox"><input checked={draft.studyArea} onChange={(event) => updateDraft("studyArea", event.target.checked)} type="checkbox" /><span>Study area</span></label>
                    <label className="mapa-admin-page__checkbox"><input checked={draft.parkingArea} onChange={(event) => updateDraft("parkingArea", event.target.checked)} type="checkbox" /><span>Parking area</span></label>
                    <label className="mapa-admin-page__checkbox"><input checked={draft.petsAllowed} onChange={(event) => updateDraft("petsAllowed", event.target.checked)} type="checkbox" /><span>Pets allowed</span></label>
                    <label className="mapa-admin-page__checkbox"><input checked={draft.security} onChange={(event) => updateDraft("security", event.target.checked)} type="checkbox" /><span>Security/CCTV</span></label>
                    <label className="mapa-admin-page__checkbox"><input checked={draft.laundryArea} onChange={(event) => updateDraft("laundryArea", event.target.checked)} type="checkbox" /><span>Laundry area</span></label>
                    <label className="mapa-admin-page__checkbox"><input checked={draft.dryingArea} onChange={(event) => updateDraft("dryingArea", event.target.checked)} type="checkbox" /><span>Drying area</span></label>
                  </div>
                  <div className="mapa-admin-page__photo-upload">
                    <div>
                      <p className="mapa-admin-page__panel-kicker">Listing photos</p>
                      <h4 className="mapa-admin-page__compact-title">Upload photos for this new listing</h4>
                      <p className="mapa-admin-page__card-copy">Select one or more images. The first photo becomes the cover image after the listing is created.</p>
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
                        <span className="mapa-admin-page__nav-badge">{draft.monthlyRentalLabel.trim() || "Draft"}</span>
                      </div>
                      <article className="mapa-admin-page__preview-card">
                        <div className="mapa-admin-page__preview-copy">
                          <h4 className="mapa-admin-page__section-title">{draft.name.trim() || "Untitled listing"}</h4>
                          <p className="mapa-admin-page__compact-copy">{draft.address.trim() || "Address will appear here once you fill in the form."}</p>
                          <p className="mapa-admin-page__card-copy">{draft.description.trim() || `${draft.accommodationType || "Listing"} in ${draft.address.trim() || "your selected location"} with ${draft.monthlyRentalLabel.toLowerCase()} monthly rent.`}</p>
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
                  <div className="mapa-admin-page__directory-list">
                    {listings.map((listing) => (
                      <button className={`mapa-admin-page__directory-card${selectedListing?.id === listing.id ? " is-selected" : ""}`} key={listing.id} onClick={() => selectListing(listing.id)} type="button">
                        <div>
                          <h4 className="mapa-admin-page__compact-title">{listing.name}</h4>
                          <p className="mapa-admin-page__compact-copy">{listing.address}</p>
                        </div>
                        <span className="mapa-admin-page__nav-badge">{listing.monthly_rental_label}</span>
                      </button>
                    ))}
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
                              selectedPhotos.map((photo) => {
                                const photoUrl = toPublicPhotoUrl(photo);
                                return (
                                  <article className="mapa-admin-page__mini-photo-card" key={photo.id}>
                                    <div className="mapa-admin-page__mini-photo" style={photoUrl ? { backgroundImage: `linear-gradient(rgba(8, 19, 15, 0.14), rgba(8, 19, 15, 0.44)), url(${photoUrl})` } : undefined} />
                                    <p className="mapa-admin-page__compact-title">{photo.caption || photo.alt_text || "Listing photo"}</p>
                                  </article>
                                );
                              })
                            ) : (
                              <p className="mapa-admin-page__feedback">No photos linked to this listing yet.</p>
                            )}
                          </div>
                        </div>
                        <div className="mapa-admin-page__detail-grid">
                          <article className="mapa-admin-page__detail-card"><h4 className="mapa-admin-page__compact-title">Property</h4><p>{selectedListing.accommodation_type}</p><p>{selectedListing.exclusivity || "Open"}</p><p>{selectedListing.rooms_available ?? 0} rooms</p><p>{selectedListing.curfew || "No curfew listed"}</p></article>
                          <article className="mapa-admin-page__detail-card"><h4 className="mapa-admin-page__compact-title">Utilities and signals</h4><p>{labelBoolean(selectedListing.utilities_included, "Utilities included", "Utilities separate")}</p><p>{formatSignals(selectedListing.cellular_signals, selectedListing.cellular_signals_raw)}</p><p>{selectedListing.bills_not_included || "No excluded bills listed"}</p></article>
                          <article className="mapa-admin-page__detail-card"><h4 className="mapa-admin-page__compact-title">Amenities</h4><p>{labelBoolean(selectedListing.has_wifi, "Wi-Fi available")}</p><p>{labelBoolean(selectedListing.has_study_area, "Study area available")}</p><p>{labelBoolean(selectedListing.has_parking_area, "Parking available")}</p></article>
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
                                      <p className="mapa-admin-page__compact-copy">{photo.is_cover ? "Current cover photo" : reorderingPhotos ? "Updating order..." : `Photo ${photo.sort_order + 1} • Drag to reorder`}</p>
                                    </div>
                                    <div className="mapa-admin-page__photo-library-actions">
                                      <button className="mapa-admin-page__action mapa-admin-page__action--ghost mapa-admin-page__action--small" disabled={photo.is_cover || isBusy || reorderingPhotos} onClick={() => void setCoverPhoto(photo.id)} type="button">{isBusy && !photo.is_cover ? "Updating..." : photo.is_cover ? "Cover photo" : "Set cover"}</button>
                                      <button className="mapa-admin-page__action mapa-admin-page__action--danger mapa-admin-page__action--small" disabled={isBusy || reorderingPhotos} onClick={() => void removeListingPhoto(photo)} type="button">{isBusy ? "Removing..." : "Delete"}</button>
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
                              <p className="mapa-admin-page__card-copy">New uploads are added to the gallery and can become the cover photo if the listing does not have one yet.</p>
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
                        <div className="mapa-admin-page__field-grid">
                          <label className="mapa-admin-page__field"><span>Accommodation name</span><input onChange={(event) => updateDraft("name", event.target.value)} type="text" value={draft.name} /></label>
                          <label className="mapa-admin-page__field"><span>Address</span><input onChange={(event) => updateDraft("address", event.target.value)} type="text" value={draft.address} /></label>
                          <label className="mapa-admin-page__field"><span>Accommodation type</span><input onChange={(event) => updateDraft("accommodationType", event.target.value)} type="text" value={draft.accommodationType} /></label>
                          <label className="mapa-admin-page__field"><span>Exclusivity</span><input onChange={(event) => updateDraft("exclusivity", event.target.value)} type="text" value={draft.exclusivity} /></label>
                          <label className="mapa-admin-page__field"><span>Monthly rental</span><input onChange={(event) => updateDraft("monthlyRentalLabel", event.target.value)} type="text" value={draft.monthlyRentalLabel} /></label>
                          <label className="mapa-admin-page__field"><span>Rooms available</span><input onChange={(event) => updateDraft("roomsAvailable", event.target.value)} type="text" value={draft.roomsAvailable} /></label>
                          <label className="mapa-admin-page__field"><span>Floors</span><input onChange={(event) => updateDraft("floorsLabel", event.target.value)} type="text" value={draft.floorsLabel} /></label>
                          <label className="mapa-admin-page__field"><span>Occupancy</span><input onChange={(event) => updateDraft("occupancyLabel", event.target.value)} type="text" value={draft.occupancyLabel} /></label>
                          <label className="mapa-admin-page__field"><span>Curfew</span><input onChange={(event) => updateDraft("curfew", event.target.value)} type="text" value={draft.curfew} /></label>
                          <label className="mapa-admin-page__field"><span>Signals</span><input onChange={(event) => updateDraft("cellularSignalsRaw", event.target.value)} type="text" value={draft.cellularSignalsRaw} /></label>
                          <label className="mapa-admin-page__field"><span>Contact person</span><input onChange={(event) => updateDraft("contactPerson", event.target.value)} type="text" value={draft.contactPerson} /></label>
                          <label className="mapa-admin-page__field"><span>Contact number</span><input onChange={(event) => updateDraft("contactNumber", event.target.value)} type="text" value={draft.contactNumber} /></label>
                          <label className="mapa-admin-page__field mapa-admin-page__field--wide"><span>Other contact information</span><textarea onChange={(event) => updateDraft("otherContactInformation", event.target.value)} rows={3} value={draft.otherContactInformation} /></label>
                          <label className="mapa-admin-page__field mapa-admin-page__field--wide"><span>Description</span><textarea onChange={(event) => updateDraft("description", event.target.value)} rows={4} value={draft.description} /></label>
                        </div>
                        <div className="mapa-admin-page__checkbox-grid">
                          <label className="mapa-admin-page__checkbox"><input checked={draft.utilitiesIncluded} onChange={(event) => updateDraft("utilitiesIncluded", event.target.checked)} type="checkbox" /><span>Utilities included</span></label>
                          <label className="mapa-admin-page__checkbox"><input checked={draft.wifi} onChange={(event) => updateDraft("wifi", event.target.checked)} type="checkbox" /><span>Wi-Fi available</span></label>
                          <label className="mapa-admin-page__checkbox"><input checked={draft.studyArea} onChange={(event) => updateDraft("studyArea", event.target.checked)} type="checkbox" /><span>Study area</span></label>
                          <label className="mapa-admin-page__checkbox"><input checked={draft.parkingArea} onChange={(event) => updateDraft("parkingArea", event.target.checked)} type="checkbox" /><span>Parking area</span></label>
                          <label className="mapa-admin-page__checkbox"><input checked={draft.petsAllowed} onChange={(event) => updateDraft("petsAllowed", event.target.checked)} type="checkbox" /><span>Pets allowed</span></label>
                          <label className="mapa-admin-page__checkbox"><input checked={draft.security} onChange={(event) => updateDraft("security", event.target.checked)} type="checkbox" /><span>Security/CCTV</span></label>
                          <label className="mapa-admin-page__checkbox"><input checked={draft.laundryArea} onChange={(event) => updateDraft("laundryArea", event.target.checked)} type="checkbox" /><span>Laundry area</span></label>
                          <label className="mapa-admin-page__checkbox"><input checked={draft.dryingArea} onChange={(event) => updateDraft("dryingArea", event.target.checked)} type="checkbox" /><span>Drying area</span></label>
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
                          <span className="mapa-admin-page__nav-badge">{new Date(item.deleted_at).toLocaleDateString()}</span>
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
    </main>
  );
}



