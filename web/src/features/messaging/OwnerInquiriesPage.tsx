import { useEffect, useState } from "react";
import { ArrowLeft, Ban, Flag, MessageSquareText, Store, UserRound } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../app/AuthProvider";
import { INQUIRY_STATUSES, type InquiryStatus } from "../../lib/domain";
import { Avatar, Button, Drawer, Menu, PageHeader, Select, useToast } from "../../ui";
import { ReportDialog } from "../reports/ReportDialog";
import { ConversationList } from "./ConversationList";
import { useInbox } from "./InboxContext";
import { fetchSavedReplies, setBlocked, setInquiryStatus, type Message, type SavedReply } from "./messagingApi";
import { MessagingLayout } from "./MessagingLayout";
import { SavedRepliesDialog } from "./SavedRepliesDialog";
import { StudentPanel } from "./StudentPanel";
import { ThreadView } from "./ThreadView";
import { useThread } from "./useThread";

const STATUS_LABELS: Record<InquiryStatus, string> = {
  new: "New inquiry",
  replied: "Replied",
  visit_scheduled: "Visit scheduled",
  closed: "Closed",
};

// Shown until the owner saves their own replies.
const STARTER_REPLIES = ["Yes, still available", "Sorry, it’s full right now", "You can visit any day this week"];

/** Owner Inquiries (frame O3): /owner/inquiries and /owner/inquiries/:conversationId */
export default function OwnerInquiriesPage() {
  const { conversationId = null } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { profile } = useAuth();
  const { conversations, status, unreadTotal, refresh } = useInbox();
  const thread = useThread(conversationId);
  const [savedReplies, setSavedReplies] = useState<SavedReply[]>([]);
  const [repliesOpen, setRepliesOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<Message | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);

  const active = conversations.find((row) => row.id === conversationId) ?? null;
  const otherName = active?.other_name || "Student";
  const blocked = { blocked: Boolean(active?.is_blocked), byMe: active?.blocked_by === profile?.id };
  const lastFromOther = [...thread.messages].reverse().find((message) => message.sender_id && message.sender_id !== profile?.id && message.kind !== "system");

  useEffect(() => {
    document.title = "Inquiries · Owner portal · mapaguapa";
    fetchSavedReplies()
      .then(setSavedReplies)
      .catch(() => setSavedReplies([]));
  }, []);

  useEffect(() => {
    if (conversationId && status === "ready" && !active) navigate("/owner/inquiries", { replace: true });
  }, [active, conversationId, navigate, status]);

  const changeStatus = async (next: InquiryStatus) => {
    if (!active) return;
    setStatusBusy(true);
    try {
      await setInquiryStatus(active.id, next);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn’t change the status.");
    } finally {
      setStatusBusy(false);
    }
  };

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

  const subtitle = `${unreadTotal} unread · students often message several places, so quick replies win tenants.`;

  const header = active && (
    <>
      <Link aria-label="Back to inquiries" className="thread-head__back" to="/owner/inquiries">
        <ArrowLeft />
      </Link>
      <Avatar name={otherName} src={active.other_avatar_url} />
      <div className="thread-head__who">
        <p className="thread-head__name">{otherName}</p>
        <p className="thread-head__sub">
          Asking about {active.listing_name || "your listing"}
          {active.interest_room ? ` · ${active.interest_room}` : ""}
        </p>
      </div>
      <div className="thread-head__actions">
        <Select
          aria-label="Inquiry status"
          className="thread-head__status"
          disabled={statusBusy}
          onChange={(event) => void changeStatus(event.target.value as InquiryStatus)}
          options={INQUIRY_STATUSES.map((value) => ({ value, label: STATUS_LABELS[value] }))}
          value={(active.inquiry_status as InquiryStatus) ?? "new"}
        />
        <Button aria-label="Student details" className="thread-head__details" iconOnly onClick={() => setDetailsOpen(true)} variant="secondary">
          <UserRound />
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

  const panel =
    active && profile ? (
      <StudentPanel
        blocked={blocked}
        conversation={active}
        messages={thread.messages}
        onReport={lastFromOther ? () => setReportTarget(lastFromOther) : null}
        onToggleBlock={() => void toggleBlock()}
        ownerId={profile.id}
      />
    ) : null;

  return (
    <>
      <PageHeader
        actions={
          <Button leadingIcon={<MessageSquareText />} onClick={() => setRepliesOpen(true)} variant="secondary">
            Saved replies
          </Button>
        }
        eyebrow="Inbox"
        subtitle={subtitle}
        title="Inquiries"
      />
      <MessagingLayout
        aside={panel}
        className="messaging--owner"
        emptyDescription="Pick an inquiry to reply, schedule a visit, or keep private notes."
        emptyTitle="Your inquiries"
        list={<ConversationList basePath="/owner/inquiries" conversations={conversations} listings={new Map()} side="owner" status={status} />}
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
              placeholder={`Reply to ${otherName.split(" ")[0]}…`}
              quickReplies={savedReplies.length > 0 ? savedReplies.map((reply) => reply.body) : STARTER_REPLIES}
              sending={thread.sending}
              status={thread.status}
              visits={thread.visits}
            />
          ) : null
        }
      />

      {panel && (
        <Drawer hideTitle onClose={() => setDetailsOpen(false)} open={detailsOpen} side="right" title="Student details">
          {panel}
        </Drawer>
      )}
      {profile && (
        <SavedRepliesDialog
          onChange={setSavedReplies}
          onClose={() => setRepliesOpen(false)}
          open={repliesOpen}
          ownerId={profile.id}
          replies={savedReplies}
        />
      )}
      {reportTarget && <ReportDialog onClose={() => setReportTarget(null)} open target={{ type: "message", messageId: reportTarget.id, name: otherName }} />}
    </>
  );
}
