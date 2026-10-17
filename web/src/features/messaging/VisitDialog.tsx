import { useEffect, useState } from "react";
import { Button, Dialog, Field, Input, Textarea } from "../../ui";
import { toLocalInputValue } from "./time";

type VisitDialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  withNote?: boolean;
  confirmLabel?: string;
  onSubmit: (at: Date, note?: string) => Promise<boolean>;
};

function defaultSlot() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(9, 0, 0, 0);
  return date;
}

/** Pick a date and time for a visit (propose or suggest another time). */
export function VisitDialog({ open, onClose, title, description, withNote = false, confirmLabel = "Send request", onSubmit }: VisitDialogProps) {
  const [value, setValue] = useState(toLocalInputValue(defaultSlot()));
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setValue(toLocalInputValue(defaultSlot()));
      setNote("");
      setError(null);
    }
  }, [open]);

  const submit = async () => {
    const at = new Date(value);
    if (Number.isNaN(at.getTime()) || at.getTime() < Date.now()) {
      setError("Pick a time in the future.");
      return;
    }
    setBusy(true);
    const ok = await onSubmit(at, note.trim() || undefined);
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <Dialog
      description={description}
      dismissible={!busy}
      footer={
        <>
          <Button disabled={busy} onClick={onClose} variant="secondary">
            Cancel
          </Button>
          <Button loading={busy} onClick={() => void submit()}>
            {confirmLabel}
          </Button>
        </>
      }
      onClose={onClose}
      open={open}
      size="sm"
      title={title}
    >
      <div className="visit-dialog">
        <Field error={error ?? undefined} label="Date and time">
          <Input min={toLocalInputValue(new Date())} onChange={(event) => setValue(event.target.value)} type="datetime-local" value={value} />
        </Field>
        {withNote && (
          <Field label="Note" optional>
            <Textarea maxLength={500} onChange={(event) => setNote(event.target.value)} placeholder="e.g. I’ll come with my mom" rows={2} value={note} />
          </Field>
        )}
      </div>
    </Dialog>
  );
}
