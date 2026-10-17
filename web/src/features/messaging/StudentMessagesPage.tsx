import { useEffect, useState } from "react";
import { ArrowLeft, BadgeCheck, CalendarPlus, Ban, Flag, Info, Phone, Store } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../app/AuthProvider";
import { Avatar, Badge, Button, Chip, Drawer, Menu, useToast } from "../../ui";
import { telHref } from "../listing/listingFacts";
import { ReportDialog } from "../reports/ReportDialog";
import { ConversationList } from "./ConversationList";
import { useInbox } from "./InboxContext";
import { ListingPanel } from "./ListingPanel";
import { fetchListingContact, setBlocked, type Message } from "./messagingApi";
import { MessagingLayout } from "./MessagingLayout";
import { ThreadView } from "./ThreadView";
import { useThread } from "./useThread";
import { VisitDialog } from "./VisitDialog";

const QUICK_QUESTIONS = ["Is it still available?", "What’s included in the rent?", "Is there a curfew?"];

/** Student Messages (frame 04): /messages and /messages/:conversationId */
export default function StudentMessagesPage() {
  const { conversationId = null } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { profile } = useAuth();
  const { conversations, listings, status, refresh } = useInbox();
  const thread = useThread(conversationId);
  const [contact, setContact] = useState<string | null>(null);
  const [visitOpen, setVisitOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<Message | null>(null);

  const active = conversations.find((row) => row.id === conversationId) ?? null;
  const listing = active?.listing_id ? listings.get(active.listing_id) : undefined;
  const otherName = active?.other_name || "Owner";
  const blocked = { blocked: Boolean(active?.is_blocked), byMe: active?.blocked_by === profile?.id };
  const tel = contact ? telHref(contact) : null;

  useEffect(() => {
    document.title = "Messages · mapaguapa";
  }, []);

  useEffect(() => {
    setContact(null);
    if (!active?.listing_id) return;
    let cancelled = false;
    fetchListingContact(active.listing_id)
      .then((number) => {
        if (!cancelled) setContact(number);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [active?.listing_id]);

  // An id that isn't ours (or was deleted) falls back to the list.
  useEffect(() => {
    if (conversationId && status === "ready" && !active) navigate("/messages", { replace: true });
  }, [active, conversationId, navigate, status]);

  const toggleBlock = async () => {
    if (!active) return;
    try {
      await setBlocked(active.id, !blocked.blocked);
      await refresh();
      toast.success(blocked.blocked ? "Conversation unblocked." : "Conversation blocked.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn’t update the conversation.");
    }
  };

  const lastFromOther = [...thread.messages].reverse().find((message) => message.sender_id && message.sender_id !== profile?.id && message.kind !== "system");

  const header = active && (
    <>
      <Link aria-label="Back to conversations" className="thread-head__back" to="/messages">
        <ArrowLeft />
      </Link>
      <Avatar name={otherName} src={active.other_avatar_url} tone="clay" />
      <div className="thread-head__who">
        <p className="thread-head__name">
          {otherName}
          {active.other_is_verified_owner && (
            <Badge icon={<BadgeCheck />} tone="green">
              Verified owner
            </Badge>
          )}
        </p>
        <p className="thread-head__sub">Owner of {active.listing_name || "this listing"}</p>
      </div>
      <div className="thread-head__actions">
        {tel && (
          <a aria-label={`Call ${otherName}`} className="ui-btn ui-btn--secondary ui-btn--md ui-btn--icon" href={tel}>
            <Phone aria-hidden="true" />
          </a>
        )}
        <Button aria-label="About this place" className="thread-head__details" iconOnly onClick={() => setDetailsOpen(true)} variant="secondary">
          <Info />
        </Button>
        <Menu
          items={[
            ...(active.listing_id
              ? [{ key: "listing", label: "View listing", icon: <Store />, onSelect: () => navigate(`/listing/${active.listing_id}`) }]
              : []),
            ...(lastFromOther ? [{ key: "report", label: "Report a message", icon: <Flag />, onSelect: () => setReportTarget(lastFromOther) }] : []),
            ...(!blocked.blocked || blocked.byMe
              ? [{ key: "block", label: blocked.blocked ? "Unblock" : "Block", icon: <Ban />, destructive: !blocked.blocked, onSelect: () => void toggleBlock() }]
              : []),
          ]}
          label="Conversation options"
        />
      </div>
    </>
  );

  return (
    <div className="v2-container messaging-page">
      <MessagingLayout
        aside={active ? <ListingPanel listing={listing} listingId={active.listing_id} /> : null}
        emptyDescription="Pick a conversation, or message an owner from any listing."
        emptyTitle="Your messages"
        list={<ConversationList basePath="/messages" conversations={conversations} listings={listings} side="student" status={status} title="Messages" />}
        thread={
          active && profile ? (
            <ThreadView
              attachmentUrls={thread.attachmentUrls}
              blocked={blocked}
              header={header}
              meId={profile.id}
              messages={thread.messages}
              onAttach={(file) => void thread.attach(file)}
              onReportMessage={setReportTarget}
              onRetry={thread.reload}
              onSend={thread.send}
              onVisitAction={thread.actOnVisit}
              otherName={otherName}
              placeholder="Write a message…"
              quickActions={
                <Chip icon={<CalendarPlus />} onClick={() => setVisitOpen(true)}>
                  Request a visit
                </Chip>
              }
              quickReplies={QUICK_QUESTIONS}
              sending={thread.sending}
              status={thread.status}
              visits={thread.visits}
            />
          ) : null
        }
      />

      {active && (
        <Drawer onClose={() => setDetailsOpen(false)} open={detailsOpen} side="right" title="About this place" hideTitle>
          <ListingPanel listing={listing} listingId={active.listing_id} />
        </Drawer>
      )}
      <VisitDialog
        description={`${otherName} will confirm or suggest another time.`}
        onClose={() => setVisitOpen(false)}
        onSubmit={thread.proposeVisit}
        open={visitOpen}
        title="Request a visit"
        withNote
      />
      {reportTarget && (
        <ReportDialog onClose={() => setReportTarget(null)} open target={{ type: "message", messageId: reportTarget.id, name: otherName }} />
      )}
    </div>
  );
}
