import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button, Dialog, Input, useToast } from "../../ui";
import { addSavedReply, deleteSavedReply, type SavedReply } from "./messagingApi";

type SavedRepliesDialogProps = {
  open: boolean;
  onClose: () => void;
  ownerId: string;
  replies: SavedReply[];
  onChange: (replies: SavedReply[]) => void;
};

const MAX_REPLIES = 12;

/** Owner's saved replies: shown as one-tap chips above the composer. */
export function SavedRepliesDialog({ open, onClose, ownerId, replies, onChange }: SavedRepliesDialogProps) {
  const toast = useToast();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const add = async () => {
    const body = draft.trim();
    if (!body) return;
    setBusy(true);
    try {
      const reply = await addSavedReply(ownerId, body, replies.length);
      onChange([...replies, reply]);
      setDraft("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn’t save the reply.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    const previous = replies;
    onChange(replies.filter((reply) => reply.id !== id));
    try {
      await deleteSavedReply(id);
    } catch {
      onChange(previous);
      toast.error("Couldn’t delete the reply.");
    }
  };

  return (
    <Dialog
      description="Tap one above the message box to drop it in, then edit before sending."
      footer={<Button onClick={onClose}>Done</Button>}
      onClose={onClose}
      open={open}
      title="Saved replies"
    >
      <div className="saved-replies">
        {replies.length === 0 && <p className="v2-muted">No saved replies yet. Add the answers you give most often.</p>}
        <ul className="saved-replies__list">
          {replies.map((reply) => (
            <li className="saved-replies__item" key={reply.id}>
              <p>{reply.body}</p>
              <Button aria-label="Delete saved reply" iconOnly onClick={() => void remove(reply.id)} size="sm" variant="ghost">
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
        {replies.length < MAX_REPLIES && (
          <form
            className="saved-replies__add"
            onSubmit={(event) => {
              event.preventDefault();
              void add();
            }}
          >
            <Input aria-label="New saved reply" maxLength={1000} onChange={(event) => setDraft(event.target.value)} placeholder="e.g. Yes, still available!" value={draft} />
            <Button disabled={!draft.trim()} leadingIcon={<Plus />} loading={busy} type="submit" variant="secondary">
              Add
            </Button>
          </form>
        )}
      </div>
    </Dialog>
  );
}
