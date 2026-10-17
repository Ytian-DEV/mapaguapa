import { useEffect, useRef, useState } from "react";
import { Ban, Flag } from "lucide-react";
import { Avatar, Textarea } from "../../ui";
import type { InboxRow, Message } from "./messagingApi";
import { fetchNote, saveNote } from "./messagingApi";
import { listTime, messageTime } from "./time";

type StudentPanelProps = {
  conversation: InboxRow;
  ownerId: string;
  messages: Message[];
  blocked: { blocked: boolean; byMe: boolean };
  onToggleBlock: () => void;
  onReport: (() => void) | null;
};

const NOTE_SAVE_DELAY_MS = 800;

/** Right column of frame O3: who's asking, inquiry details and a private note. */
export function StudentPanel({ conversation, ownerId, messages, blocked, onToggleBlock, onReport }: StudentPanelProps) {
  const [note, setNote] = useState("");
  const [noteState, setNoteState] = useState<"idle" | "loading" | "saving" | "saved" | "error">("loading");
  const loadedFor = useRef<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    loadedFor.current = null;
    setNoteState("loading");
    fetchNote(conversation.id)
      .then((value) => {
        if (cancelled) return;
        setNote(value);
        loadedFor.current = conversation.id;
        setNoteState("idle");
      })
      .catch(() => {
        if (!cancelled) setNoteState("error");
      });
    return () => {
      cancelled = true;
      window.clearTimeout(timer.current);
    };
  }, [conversation.id]);

  const onNoteChange = (value: string) => {
    setNote(value);
    if (loadedFor.current !== conversation.id) return;
    window.clearTimeout(timer.current);
    setNoteState("saving");
    const id = conversation.id;
    timer.current = window.setTimeout(() => {
      saveNote(id, ownerId, value).then(
        () => setNoteState("saved"),
        () => setNoteState("error")
      );
    }, NOTE_SAVE_DELAY_MS);
  };

  const first = messages.find((message) => message.sender_id === conversation.student_id);
  const rows: Array<[string, string]> = [];
  if (conversation.interest_room) rows.push(["Interested in", conversation.interest_room]);
  if (conversation.move_in_label) rows.push(["Moving in", conversation.move_in_label]);
  if (conversation.party_size) rows.push(["People", String(conversation.party_size)]);
  if (first) rows.push(["First message", `${listTime(first.created_at)}, ${messageTime(first.created_at)}`]);
  if (conversation.listing_name) rows.push(["Listing", conversation.listing_name]);

  const noteStatus =
    noteState === "saving" ? "Saving…" : noteState === "saved" ? "Saved" : noteState === "error" ? "Couldn’t save — keep typing to retry" : "";

  return (
    <div className="side-panel">
      <div className="side-panel__person">
        <Avatar name={conversation.other_name} size="lg" src={conversation.other_avatar_url} />
        <p className="side-panel__person-name">{conversation.other_name || "Student"}</p>
      </div>

      {rows.length > 0 && (
        <dl className="side-panel__rows">
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}

      <div style={{ display: "grid", gap: 6 }}>
        <label className="side-panel__label" htmlFor="private-note">
          Private note
        </label>
        <Textarea
          className="side-panel__note"
          disabled={noteState === "loading"}
          id="private-note"
          maxLength={2000}
          onChange={(event) => onNoteChange(event.target.value)}
          placeholder="Only you can see this"
          value={note}
        />
        <span aria-live="polite" className="side-panel__note-status">
          {noteStatus}
        </span>
      </div>

      <div style={{ display: "flex", gap: 16 }}>
        {(!blocked.blocked || blocked.byMe) && (
          <button className="side-panel__danger" onClick={onToggleBlock} type="button">
            <Ban aria-hidden="true" />
            {blocked.blocked ? "Unblock" : "Block"}
          </button>
        )}
        {onReport && (
          <button className="side-panel__danger" onClick={onReport} type="button">
            <Flag aria-hidden="true" />
            Report
          </button>
        )}
      </div>
    </div>
  );
}
