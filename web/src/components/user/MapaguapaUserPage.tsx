import { useEffect, useMemo, useState } from "react";
import HouseMark from "../shared/HouseMark";
import { usePointerGlow } from "../shared/usePointerGlow";
import { fetchActiveListings } from "../../lib/listingService";
import { fallbackDescription, formatSignals, getListingCover, labelBoolean, type ListingWithPhotos, type Profile } from "../../lib/models";
import "./mapaguapa-user.css";

type MapaguapaUserPageProps = {
  onSignOut: () => Promise<void>;
  profile: Profile;
};

export default function MapaguapaUserPage({ onSignOut, profile }: MapaguapaUserPageProps) {
  const [listings, setListings] = useState<ListingWithPhotos[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const {
    pageRef,
    handlePointerEnter,
    handlePointerLeave,
    handlePointerMove,
  } = usePointerGlow({ centerXRatio: 0.4, centerYRatio: 0.32 });

  useEffect(() => {
    let cancelled = false;

    const loadListings = async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await fetchActiveListings();
        if (!cancelled) {
          setListings(data);
          setSelectedId((current) => current || data[0]?.id || "");
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load listings.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadListings();

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedListing = useMemo(
    () => listings.find((listing) => listing.id === selectedId) ?? listings[0] ?? null,
    [listings, selectedId]
  );

  const listingCount = listings.length.toString().padStart(2, "0");

  return (
    <main
      className="mapa-user-page"
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onPointerMove={handlePointerMove}
      ref={pageRef}
    >
      <div className="mapa-user-page__orb mapa-user-page__orb--left" />
      <div className="mapa-user-page__orb mapa-user-page__orb--right" />
      <div className="mapa-user-page__grid" />
      <div className="mapa-user-page__mouse-glow" />
      <div className="mapa-user-page__mouse-warp" />

      <div className="mapa-user-page__shell">
        <aside className="mapa-user-page__sidebar">
          <div className="mapa-user-page__brand">
            <div className="mapa-user-page__brand-icon">
              <HouseMark className="mapa-user-page__house-icon" />
            </div>
            <div>
              <p className="mapa-user-page__eyebrow">MAPAGUAPA</p>
              <h1 className="mapa-user-page__brand-title">Student listings</h1>
            </div>
          </div>

          <section className="mapa-user-page__intro">
            <p className="mapa-user-page__kicker">Welcome</p>
            <h2 className="mapa-user-page__headline">{profile.full_name || profile.email || "Student explorer"}</h2>
            <p className="mapa-user-page__copy">
              Browse available accommodations, inspect photos, and review the owner contact details pulled from the database.
            </p>
          </section>

          <section className="mapa-user-page__stats">
            <article className="mapa-user-page__stat-card">
              <p className="mapa-user-page__stat-label">Available listings</p>
              <p className="mapa-user-page__stat-value">{listingCount}</p>
            </article>
            <article className="mapa-user-page__stat-card">
              <p className="mapa-user-page__stat-label">Account role</p>
              <p className="mapa-user-page__stat-value">{profile.role}</p>
            </article>
          </section>

          <button className="mapa-user-page__signout" onClick={() => void onSignOut()} type="button">
            Sign out
          </button>
        </aside>

        <section className="mapa-user-page__workspace">
          <header className="mapa-user-page__workspace-head">
            <div>
              <p className="mapa-user-page__kicker">User dashboard</p>
              <h2 className="mapa-user-page__workspace-title">Explore boarding houses and dormitories</h2>
            </div>
          </header>

          {loading && <p className="mapa-user-page__feedback">Loading listings from Supabase...</p>}
          {error && <p className="mapa-user-page__feedback mapa-user-page__feedback--error">{error}</p>}

          {!loading && !error && listings.length === 0 && (
            <p className="mapa-user-page__feedback">No active listings are available yet.</p>
          )}

          {!loading && !error && selectedListing && (
            <div className="mapa-user-page__content-grid">
              <section className="mapa-user-page__listing-list">
                {listings.map((listing) => (
                  <button
                    className={`mapa-user-page__listing-card${selectedListing.id === listing.id ? " is-selected" : ""}`}
                    key={listing.id}
                    onClick={() => setSelectedId(listing.id)}
                    type="button"
                  >
                    <div>
                      <h3 className="mapa-user-page__listing-title">{listing.name}</h3>
                      <p className="mapa-user-page__listing-address">{listing.address}</p>
                    </div>
                    <div className="mapa-user-page__tag-row">
                      <span>{listing.accommodation_type}</span>
                      <span>{listing.monthly_rental_label}</span>
                      <span>{listing.exclusivity || "Open"}</span>
                    </div>
                  </button>
                ))}
              </section>

              <section className="mapa-user-page__detail-panel">
                <div className="mapa-user-page__hero-image" style={getListingCover(selectedListing) ? { backgroundImage: `linear-gradient(rgba(10, 22, 17, 0.24), rgba(10, 22, 17, 0.55)), url(${getListingCover(selectedListing)})` } : undefined} />

                <div className="mapa-user-page__detail-body">
                  <div className="mapa-user-page__detail-head">
                    <div>
                      <p className="mapa-user-page__kicker">Listing details</p>
                      <h3 className="mapa-user-page__detail-title">{selectedListing.name}</h3>
                      <p className="mapa-user-page__listing-address">{selectedListing.address}</p>
                    </div>
                    <span className="mapa-user-page__detail-price">{selectedListing.monthly_rental_label}</span>
                  </div>

                  <p className="mapa-user-page__detail-copy">{fallbackDescription(selectedListing)}</p>

                  <div className="mapa-user-page__detail-grid">
                    <article className="mapa-user-page__detail-card">
                      <h4>Accommodation</h4>
                      <p>{selectedListing.accommodation_type}</p>
                      <p>{selectedListing.exclusivity || "Open to students"}</p>
                      <p>{selectedListing.rooms_available ?? 0} rooms available</p>
                      <p>{selectedListing.curfew || "No curfew listed"}</p>
                    </article>
                    <article className="mapa-user-page__detail-card">
                      <h4>Amenities</h4>
                      <p>{labelBoolean(selectedListing.has_wifi, "Wi-Fi available")}</p>
                      <p>{labelBoolean(selectedListing.has_study_area, "Study area available")}</p>
                      <p>{labelBoolean(selectedListing.has_laundry_area, "Laundry area available")}</p>
                      <p>{labelBoolean(selectedListing.has_parking_area, "Parking available")}</p>
                    </article>
                    <article className="mapa-user-page__detail-card">
                      <h4>Signals and billing</h4>
                      <p>{formatSignals(selectedListing.cellular_signals, selectedListing.cellular_signals_raw)}</p>
                      <p>{selectedListing.bills_not_included || "No excluded bills listed"}</p>
                      <p>{labelBoolean(selectedListing.utilities_included, "Utilities included", "Utilities billed separately")}</p>
                    </article>
                    <article className="mapa-user-page__detail-card">
                      <h4>Owner contact</h4>
                      <p>{selectedListing.contact_person || "No contact person listed"}</p>
                      <p>{selectedListing.contact_number || "No contact number listed"}</p>
                      <p>{selectedListing.other_contact_information || "No extra contact information"}</p>
                    </article>
                  </div>
                </div>
              </section>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}