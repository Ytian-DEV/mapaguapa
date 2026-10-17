import { BadgeCheck, HelpCircle, Home, List, MessageSquare, Plus, User } from "lucide-react";
import { AppShell, Card, Sidebar } from "../ui";
import type { InboxRow } from "../features/messaging/messagingApi";
import type { OwnerListing, OwnerOverview, UpcomingVisit } from "../features/owner/ownerApi";
import { OwnerListingRow } from "../features/owner/OwnerListingRow";
import { OwnerOverviewView } from "../features/owner/OwnerOverviewView";

// Dev-only fixtures (not bundled in production).
const now = Date.now();
const iso = (hours: number) => new Date(now - hours * 3_600_000).toISOString();

const base: Omit<OwnerListing, "id" | "name" | "status"> = {
  area: "Guadalupe",
  exclusivity_group: "mixed",
  price_band: "3000_plus",
  monthly_rental_label: "₱3,000+",
  review_note: null,
  rooms_total: 8,
  rooms_available: 1,
  updated_at: iso(20),
  submitted_at: null,
  published_at: iso(500),
  draft_step: null,
  cover_bucket: null,
  cover_path: null,
  photo_count: 6,
};

const listings: OwnerListing[] = [
  { ...base, id: "o1", name: "Fixture Boarding House", status: "published" },
  { ...base, id: "o2", name: "Fixture Annex", status: "in_review", price_band: "2000_2999", rooms_available: 3 },
  { ...base, id: "o3", name: "", status: "draft", draft_step: 2, price_band: null, updated_at: iso(26) },
  { ...base, id: "o4", name: "Fixture Rooms", status: "changes_requested", review_note: "Add a photo of the comfort room." },
];

const overview: OwnerOverview = {
  views_30d: 412,
  views_prev_30d: 349,
  new_inquiries: 9,
  unread: 3,
  avg_reply_minutes: 135,
  listings: [{ id: "o1", views_30d: 412, inquiries: 7 }],
};

const convo = (id: string, name: string, preview: string, hours: number, unread: number, room: string | null = null): InboxRow => ({
  id,
  listing_id: "o1",
  listing_name: "Fixture Boarding House",
  student_id: `s-${id}`,
  owner_id: "owner",
  my_side: "owner",
  other_id: `s-${id}`,
  other_name: name,
  other_avatar_url: null,
  other_is_verified_owner: false,
  inquiry_status: "new",
  interest_room: room,
  move_in_label: null,
  party_size: null,
  last_message_at: iso(hours),
  last_message_preview: preview,
  last_message_sender_id: `s-${id}`,
  is_blocked: false,
  blocked_by: null,
  created_at: iso(hours + 10),
  unread_count: unread,
  has_open_visit: false,
});

const conversations = [
  convo("c1", "Fixture Student", "Is there a room for 4?", 1, 1, "Room for 4"),
  convo("c2", "Second Student", "Is electricity sub-metered per room?", 3, 1, "Room for 2"),
  convo("c3", "Third Student", "Thank you po! See you Saturday.", 7, 0),
];

const visits: UpcomingVisit[] = [
  { id: "v1", conversation_id: "c3", proposed_by: "s-c3", proposed_at: new Date(now + 2 * 86_400_000).toISOString(), note: null, status: "confirmed", responded_by: "owner", responded_at: iso(2), replaced_by: null, created_at: iso(5) },
  { id: "v2", conversation_id: "c1", proposed_by: "s-c1", proposed_at: new Date(now + 4 * 86_400_000).toISOString(), note: null, status: "pending", responded_by: null, responded_at: null, replaced_by: null, created_at: iso(1) },
];

export default function OwnerPreview() {
  return (
    <AppShell
      sidebar={
        <Sidebar
          groups={[
            {
              label: "Manage",
              items: [
                { to: "/dev/owner", label: "Overview", icon: <Home />, end: true },
                { to: "/owner/listings", label: "My listings", icon: <List />, count: 4 },
                { to: "/owner/inquiries", label: "Inquiries", icon: <MessageSquare />, count: 2, emphasis: true },
                { to: "/owner/listings/new", label: "Create listing", icon: <Plus /> },
              ],
            },
            {
              label: "Account",
              items: [
                { to: "/owner/verification", label: "Verification", icon: <BadgeCheck /> },
                { to: "/owner/profile", label: "Profile", icon: <User /> },
                { to: "/about", label: "Help", icon: <HelpCircle /> },
              ],
            },
          ]}
          homeTo="/dev/owner"
          onSignOut={() => undefined}
          user={{ name: "Fixture Owner", subtitle: "Owner · Verified", tone: "clay" }}
          workspace="Owner portal"
        />
      }
    >
      <OwnerOverviewView conversations={conversations} firstName="Fixture" listings={listings} overview={overview} ownerId="owner" status="ready" visits={visits} />
      <h2 className="v2-h3" style={{ margin: "40px 0 12px" }}>
        All statuses (My listings rows)
      </h2>
      <Card className="owner-card" padding="none">
        <ul className="owner-list">
          {listings.map((listing) => (
            <OwnerListingRow key={listing.id} listing={listing} stats={overview.listings.find((item) => item.id === listing.id)} />
          ))}
        </ul>
      </Card>
    </AppShell>
  );
}
