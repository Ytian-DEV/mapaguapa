import { Fragment, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { AlertTriangle, CalendarDays, Check, Flag, ImagePlus, Send } from "lucide-react";
import { Badge, Button, Chip, EmptyState, Skeleton, cx } from "../../ui";
import type { Message, VisitAction, VisitRequest } from "./messagingApi";
import { dayLabel, messageTime, sameDay, visitLabel } from "./time";
import { VisitDialog } from "./VisitDialog";

type ThreadViewProps = {
  meId: string;
  otherName: string;
  status: "loading" | "ready" | "error";
  messages: Message[];
  visits: Map<string, VisitRequest>;
  attachmentUrls: Map<string, string>;
  header: ReactNode;
  /** One-tap text chips above the composer (quick questions / saved replies). */
  quickReplies: string[];
  /** Extra chip(s) after the quick replies, e.g. "Request a visit". */
  quickActions?: ReactNode;
  blocked: { blocked: boolean; byMe: boolean };
  sending: boolean;
  onSend: (body: string) => Promise<boolean>;
  onAttach: (file: File) => void;
  onVisitAction: (visitId: string, action: VisitAction, newAt?: Date) => Promise<boolean>;
  onReportMessage?: (message: Message) => void;
  onRetry: () => void;
  placeholder: string;
};

const VISIT_STATUS: Record<string, { label: string; tone: "green" | "amber" | "red" | "gray" }> = {
  confirmed: { label: "Confirmed", tone: "green" },
  declined: { label: "Declined", tone: "red" },
  rescheduled: { label: "New time suggested", tone: "gray" },
  cancelled: { label: "Cancelled", tone: "gray" },
};

function VisitCard({
  visit,
  meId,
  otherName,
  onAction,
}: {
  visit: VisitRequest;
  meId: string;
  otherName: string;
  onAction: (visitId: string, action: VisitAction, newAt?: Date) => Promise<boolean>;
}) {
  const [busy, setBusy] = useState<VisitAction | null>(null);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const mine = visit.proposed_by === meId;
  const pending = visit.status === "pending";
  const status = VISIT_STATUS[visit.status];

  const run = async (action: VisitAction, newAt?: Date) => {
    setBusy(action);
    const ok = await onAction(visit.id, action, newAt);
    setBusy(null);
    return ok;
  };

  return (
    <div className="visit-card">
      <div className="visit-card__top">
        <span aria-hidden="true" className="visit-card__icon">
          <CalendarDays />
        </span>
        <div className="visit-card__text">
          <p className="v2-eyebrow">Visit request</p>
          <p className="visit-card__when">{visitLabel(visit.proposed_at)}</p>
          {visit.note && <p className="visit-card__note">“{visit.note}”</p>}
        </div>
        {pending ? (
          <Badge dot tone="amber">
            {mine ? `Waiting for ${otherName.split(" ")[0]}` : "Needs reply"}
          </Badge>
        ) : (
          status && (
            <Badge dot tone={status.tone}>
              {status.label}
            </Badge>
          )
        )}
      </div>
      {pending && !mine && (
        <div className="visit-card__actions">
          <Button disabled={busy !== null} onClick={() => setSuggestOpen(true)} size="sm" variant="secondary">
            Suggest another time
          </Button>
          <Button leadingIcon={<Check />} loading={busy === "confirm"} onClick={() => void run("confirm")} size="sm">
            Confirm visit
          </Button>
          <button className="visit-card__link" disabled={busy !== null} onClick={() => void run("decline")} type="button">
            Decline
          </button>
        </div>
      )}
      {mine && (visit.status === "pending" || visit.status === "confirmed") && (
        <div className="visit-card__actions">
          <button className="visit-card__link" disabled={busy !== null} onClick={() => void run("cancel")} type="button">
            Cancel visit
          </button>
        </div>
      )}
      <VisitDialog
        confirmLabel="Suggest this time"
        description={`${otherName} will be asked to confirm the new time.`}
        onClose={() => setSuggestOpen(false)}
        onSubmit={(at) => run("reschedule", at)}
        open={suggestOpen}
        title="Suggest another time"
      />
    </div>
  );
}

/** Middle column of frames 04 / O3: header, messages and composer. */
export function ThreadView({
  meId,
  otherName,
  status,
  messages,
  visits,
  attachmentUrls,
  header,
  quickReplies,
  quickActions,
  blocked,
  sending,
  onSend,
  onAttach,
  onVisitAction,
  onReportMessage,
  onRetry,
  placeholder,
}: ThreadViewProps) {
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  // Stick to the newest message.
  useLayoutEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages.length, status]);

  // Grow the composer with its content (max ~5 lines).
  useEffect(() => {
    const node = textRef.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, 132)}px`;
  }, [draft]);

  const submit = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    const ok = await onSend(body);
    if (ok) setDraft("");
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void submit();
    }
  };

  return (
    <section aria-label={`Conversation with ${otherName}`} className="thread">
      <header className="thread__header">{header}</header>

      <div aria-live="polite" className="thread__scroll" ref={scrollRef} role="log">
        {status === "loading" && (
          <div aria-hidden="true" className="thread__skeleton">
            <Skeleton height={56} radius="16px" width="55%" />
            <Skeleton className="thread__skeleton-mine" height={44} radius="16px" width="45%" />
            <Skeleton height={64} radius="16px" width="60%" />
          </div>
        )}
        {status === "error" && (
          <EmptyState
            action={
              <Button onClick={onRetry} variant="secondary">
                Try again
              </Button>
            }
            compact
            icon={<AlertTriangle />}
            title="Couldn’t load messages"
            tone="error"
          />
        )}
        {status === "ready" && messages.length === 0 && (
          <p className="thread__empty">Say hello — ask about rooms, rent or a visit.</p>
        )}
        {status === "ready" &&
          messages.map((message, index) => {
            const previous = messages[index - 1];
            const newDay = !previous || !sameDay(previous.created_at, message.created_at);
            const mine = message.sender_id === meId;
            const visit = message.visit_request_id ? visits.get(message.visit_request_id) : undefined;

            let content: ReactNode;
            if (message.kind === "system") {
              content = <p className="thread__system">{message.body}</p>;
            } else if (message.kind === "visit" && visit) {
              content = (
                <div className={cx("bubble-row", mine && "bubble-row--mine")}>
                  <VisitCard meId={meId} onAction={onVisitAction} otherName={otherName} visit={visit} />
                </div>
              );
            } else {
              const image = message.attachment_path ? attachmentUrls.get(message.attachment_path) : undefined;
              content = (
                <div className={cx("bubble-row", mine && "bubble-row--mine")}>
                  <div className={cx("bubble", mine ? "bubble--mine" : "bubble--theirs", message.kind === "image" && "bubble--image")}>
                    {message.kind === "image" ? (
                      image ? (
                        <a href={image} rel="noreferrer" target="_blank">
                          <img alt="Photo sent in chat" loading="lazy" src={image} />
                        </a>
                      ) : (
                        <span className="bubble__loading">Loading photo…</span>
                      )
                    ) : (
                      <p>{message.body}</p>
                    )}
                  </div>
                  <span className="bubble__meta">
                    <time dateTime={message.created_at}>{messageTime(message.created_at)}</time>
                    {!mine && onReportMessage && (
                      <button aria-label="Report this message" className="bubble__report" onClick={() => onReportMessage(message)} type="button">
                        <Flag aria-hidden="true" />
                      </button>
                    )}
                  </span>
                </div>
              );
            }

            return (
              <Fragment key={message.id}>
                {newDay && (
                  <p className="thread__day">
                    <span>{dayLabel(message.created_at)}</span>
                  </p>
                )}
                {content}
              </Fragment>
            );
          })}
      </div>

      <footer className="thread__composer">
        {blocked.blocked ? (
          <p className="thread__blocked">
            {blocked.byMe ? "You blocked this conversation. Unblock it from the ⋯ menu to send messages." : "You can’t reply to this conversation."}
          </p>
        ) : (
          <>
            {(quickReplies.length > 0 || quickActions) && (
              <div className="thread__quick">
                {quickReplies.map((reply) => (
                  <Chip
                    key={reply}
                    onClick={() => {
                      setDraft(reply);
                      textRef.current?.focus();
                    }}
                  >
                    {reply}
                  </Chip>
                ))}
                {quickActions}
              </div>
            )}
            <form
              className="thread__form"
              onSubmit={(event) => {
                event.preventDefault();
                void submit();
              }}
            >
              <input
                accept="image/*"
                className="v2-sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) onAttach(file);
                  event.target.value = "";
                }}
                ref={fileRef}
                tabIndex={-1}
                type="file"
              />
              <Button aria-label="Attach a photo" disabled={sending} iconOnly onClick={() => fileRef.current?.click()} variant="secondary">
                <ImagePlus />
              </Button>
              <label className="v2-sr-only" htmlFor="thread-message">
                Message
              </label>
              <textarea
                className="ui-input thread__input"
                id="thread-message"
                maxLength={4000}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={onKeyDown}
                placeholder={placeholder}
                ref={textRef}
                rows={1}
                value={draft}
              />
              <Button disabled={!draft.trim()} leadingIcon={<Send />} loading={sending} type="submit">
                Send
              </Button>
            </form>
          </>
        )}
      </footer>
    </section>
  );
}
