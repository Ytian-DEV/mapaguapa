import { useMemo, useState } from "react";
import { BadgeCheck, CalendarPlus } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { Avatar, Badge, Chip, Segmented, TopNav } from "../ui";
import { ConversationList } from "../features/messaging/ConversationList";
import { ListingPanel } from "../features/messaging/ListingPanel";
import type { InboxRow, ListingSummary, Message, VisitAction, VisitRequest } from "../features/messaging/messagingApi";
import { MessagingLayout } from "../features/messaging/MessagingLayout";
import { ThreadView } from "../features/messaging/ThreadView";
import "../features/browse/student-shell.css";

// Dev-only fixtures (not bundled in production).
const ME_STUDENT = "student-me";
const ME_OWNER = "owner-me";
const now = Date.now();
const iso = (minutesAgo: number) => new Date(now - minutesAgo * 60_000).toISOString();

function inboxRow(partial: Partial<InboxRow> & { id: string }): InboxRow {
  return {
    listing_id: "l1",
    listing_name: "Fixture Boarding House",
    student_id: ME_STUDENT,
    owner_id: ME_OWNER,
    my_side: "student",
    other_id: ME_OWNER,
    other_name: "Fixture Owner",
    other_avatar_url: null,
    other_is_verified_owner: true,
    inquiry_status: "replied",
    interest_room: "Room for 2",
    move_in_label: "2nd semester",
    party_size: 2,
    last_message_at: iso(5),
    last_message_preview: "Sure, 9 AM works.",
    last_message_sender_id: ME_OWNER,
    is_blocked: false,
    blocked_by: null,
    created_at: iso(3000),
    unread_count: 0,
    has_open_visit: true,
    ...partial,
  };
}

const listing: ListingSummary = {
  id: "l1",
  name: "Fixture Boarding House",
  area: "Guadalupe",
  accommodation_type: "Boarding house",
  price_band: "3000_plus",
  monthly_rental_label: "₱3,000+",
  rooms_total: 8,
  rooms_available: 1,
  exclusivity_group: "mixed",
  curfew: "10 PM",
  has_curfew: true,
  cover_bucket: null,
  cover_path: null,
};

const message = (id: string, sender: string | null, minutesAgo: number, body: string | null, extra: Partial<Message> = {}): Message => ({
  id,
  conversation_id: "c1",
  sender_id: sender,
  kind: "text",
  body,
  attachment_path: null,
  visit_request_id: null,
  created_at: iso(minutesAgo),
  ...extra,
});

const initialVisits: VisitRequest[] = [
  { id: "v1", conversation_id: "c1", proposed_by: ME_STUDENT, proposed_at: new Date(now + 2 * 86_400_000).toISOString(), note: "Saturday morning?", status: "confirmed", responded_by: ME_OWNER, responded_at: iso(30), replaced_by: null, created_at: iso(60) },
  { id: "v2", conversation_id: "c1", proposed_by: ME_OWNER, proposed_at: new Date(now + 4 * 86_400_000).toISOString(), note: null, status: "pending", responded_by: null, responded_at: null, replaced_by: null, created_at: iso(8) },
];

const initialMessages: Message[] = [
  message("m1", ME_STUDENT, 1500, "Hi po! Is there still a room for 2 people starting second semester?"),
  message("m2", ME_OWNER, 1440, "Hello! Yes, we have one room left good for 2. ₱3,000 each — internet and water already included."),
  message("m3", ME_STUDENT, 62, "Can we visit this Saturday morning?"),
  message("m4", ME_STUDENT, 60, null, { kind: "visit", visit_request_id: "v1" }),
  message("m5", null, 30, "Visit confirmed.", { kind: "system", visit_request_id: "v1" }),
  message("m6", ME_OWNER, 9, "A second option in case Saturday doesn’t work:"),
  message("m7", ME_OWNER, 8, null, { kind: "visit", visit_request_id: "v2" }),
  message("m8", ME_OWNER, 5, null, { kind: "image", attachment_path: "c1/photo.jpg" }),
];

export default function MessagesPreview() {
  const [params, setParams] = useSearchParams();
  const side = params.get("side") === "owner" ? "owner" : "student";
  const meId = side === "owner" ? ME_OWNER : ME_STUDENT;
  const [messages, setMessages] = useState(initialMessages);
  const [visits, setVisits] = useState(new Map(initialVisits.map((visit) => [visit.id, visit])));
  const [blocked, setBlocked] = useState(false);

  const conversations = useMemo(
    () =>
      side === "student"
        ? [
            inboxRow({ id: "c1" }),
            inboxRow({ id: "c2", listing_id: "l2", listing_name: "Fixture Study Lodge", other_name: "Second Owner", other_is_verified_owner: false, last_message_preview: "Yes, still available for next sem.", last_message_at: iso(1500), unread_count: 1, has_open_visit: false }),
          ]
        : [
            inboxRow({ id: "c1", my_side: "owner", other_id: ME_STUDENT, other_name: "Fixture Student", unread_count: 1, last_message_preview: "Visit request", inquiry_status: "new" }),
            inboxRow({ id: "c3", my_side: "owner", other_id: "s2", other_name: "Another Student", last_message_preview: "Is electricity sub-metered per room?", unread_count: 1, has_open_visit: false, last_message_at: iso(200) }),
          ],
    [side]
  );
  const active = conversations[0];
  const otherName = active.other_name ?? "";

  const onVisitAction = async (visitId: string, action: VisitAction) => {
    setVisits((current) => {
      const next = new Map(current);
      const visit = next.get(visitId);
      if (visit) next.set(visitId, { ...visit, status: action === "confirm" ? "confirmed" : action === "decline" ? "declined" : action === "cancel" ? "cancelled" : "rescheduled" });
      return next;
    });
    return true;
  };

  const header = (
    <>
      <Avatar name={otherName} tone={side === "student" ? "clay" : "sage"} />
      <div className="thread-head__who">
        <p className="thread-head__name">
          {otherName}
          {side === "student" && (
            <Badge icon={<BadgeCheck />} tone="green">
              Verified owner
            </Badge>
          )}
        </p>
        <p className="thread-head__sub">{side === "student" ? "Owner of Fixture Boarding House" : "Asking about Fixture Boarding House · Room for 2"}</p>
      </div>
      <Chip onClick={() => setBlocked((value) => !value)}>{blocked ? "Unblock" : "Block"}</Chip>
    </>
  );

  return (
    <div className="v2 student-shell">
      <TopNav links={[{ to: "/dev/messages", label: "Messages", badge: 1 }]} user={{ name: "Dev" }} />
      <div className="v2-container" style={{ paddingBlock: "16px 40px", display: "grid", gap: 12 }}>
        <Segmented
          items={[
            { value: "student", label: "Student" },
            { value: "owner", label: "Owner" },
          ]}
          label="Side"
          onChange={(value) => setParams({ side: value })}
          value={side}
        />
        <MessagingLayout
          aside={side === "student" ? <ListingPanel listing={listing} listingId="l1" /> : null}
          emptyDescription=""
          emptyTitle=""
          list={<ConversationList basePath="/dev/messages" conversations={conversations} listings={new Map([["l1", listing]])} side={side} status="ready" title={side === "student" ? "Messages" : undefined} />}
          thread={
            <ThreadView
              attachmentUrls={new Map()}
              blocked={{ blocked, byMe: true }}
              header={header}
              meId={meId}
              messages={messages}
              onAttach={() => undefined}
              onReportMessage={() => undefined}
              onRetry={() => undefined}
              onSend={async (body) => {
                setMessages((current) => [...current, message(`m${current.length + 1}`, meId, 0, body)]);
                return true;
              }}
              onVisitAction={onVisitAction}
              otherName={otherName}
              placeholder="Write a message…"
              quickActions={
                side === "student" ? (
                  <Chip icon={<CalendarPlus />} onClick={() => undefined}>
                    Request a visit
                  </Chip>
                ) : undefined
              }
              quickReplies={side === "student" ? ["Is it still available?", "What’s included in the rent?"] : ["Yes, still available", "Sorry, it’s full right now"]}
              sending={false}
              status="ready"
              visits={visits}
            />
          }
        />
      </div>
    </div>
  );
}
