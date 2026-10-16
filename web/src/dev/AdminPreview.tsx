import { AdminShell } from "../features/admin/AdminShell";
import type { ActivityWithActor, AdminListingRow, AdminOverview } from "../features/admin/adminApi";
import { AdminOverviewView } from "../features/admin/AdminOverviewView";

// Dev-only fixtures (not bundled in production).
const now = Date.now();
const iso = (hours: number) => new Date(now - hours * 3_600_000).toISOString();

const overview: AdminOverview = {
  listings: { published: 90, in_review: 3, changes_requested: 1, drafts: 2, archived: 7, oldest_in_review_at: iso(50), published_without_photos: 1 },
  photos: 196,
  price_bands: { under_1000: 20, "1000_1999": 43, "2000_2999": 16, "3000_plus": 11 },
  users: { total: 760, students: 745, owners: 13, admins: 2, deactivated: 0, possible_duplicates: 2 },
  reports: { open: 2, latest_open_reason: "wrong_info" },
  verifications: { pending: 1 },
};

const act = (id: number, actor: string | null, action: string, summary: string, hours: number, metaValue: Record<string, unknown> = {}): ActivityWithActor => ({
  id,
  actor_id: actor,
  actor_name: actor === "me" ? "Fixture Admin" : actor ? "Fixture Owner" : null,
  action,
  entity_type: action.split(".")[0],
  entity_id: null,
  summary,
  meta: metaValue as ActivityWithActor["meta"],
  created_at: iso(hours),
});

const activity = [
  act(1, "owner", "listing.in_review", "Fixture Annex", 2),
  act(2, "me", "listing.published", "Fixture Dormitory", 26, { from: "archived" }),
  act(3, "me", "listing.archived", "Old Fixture Place", 400),
  act(4, "me", "user.role_changed", "Fixture Owner", 500, { from: "student", to: "owner" }),
  act(5, null, "report.created", "wrong_info", 520),
];

const row = (id: string, name: string, status: string, photos: number, band: string): AdminListingRow => ({
  id,
  name,
  area: "Guadalupe",
  exclusivity_group: "mixed",
  price_band: band,
  monthly_rental_label: "",
  status,
  review_note: null,
  rooms_total: 8,
  rooms_available: 2,
  updated_at: iso(3),
  submitted_at: null,
  published_at: null,
  draft_step: null,
  cover_bucket: null,
  cover_path: null,
  photo_count: photos,
  added_by: "owner",
  owner_name: "Fixture Owner",
});

const recent = [
  row("r1", "Fixture Boarding House", "published", 6, "3000_plus"),
  row("r2", "Fixture Annex", "in_review", 4, "2000_2999"),
  row("r3", "Fixture Lodge", "published", 0, "1000_1999"),
];

export default function AdminPreview() {
  return (
    <AdminShell overview={overview}>
      <AdminOverviewView activity={activity} mapKeyMissing meId="me" onExport={() => undefined} overview={overview} recentListings={recent} status="ready" />
    </AdminShell>
  );
}
