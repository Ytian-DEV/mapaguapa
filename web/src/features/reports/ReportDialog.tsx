import { useEffect, useState } from "react";
import type { ReportReason } from "../../lib/domain";
import { supabase } from "../../lib/supabase";
import { Button, Dialog, Field, RadioCards, Textarea, useToast } from "../../ui";

export const REPORT_REASON_LABELS: Record<ReportReason, { label: string; description: string }> = {
  scam: { label: "Scam or fake", description: "Asks for money upfront, or the place doesn’t exist" },
  wrong_info: { label: "Wrong details", description: "Price, phone number or rules are wrong" },
  unavailable: { label: "No longer available", description: "Full, closed, or not renting anymore" },
  inappropriate: { label: "Inappropriate content", description: "Offensive photos or text" },
  harassment: { label: "Harassment", description: "Rude, threatening or unwanted messages" },
  safety: { label: "Safety concern", description: "Unsafe building or conditions" },
  other: { label: "Something else", description: "Tell us below" },
};

const LISTING_REASONS: ReportReason[] = ["scam", "wrong_info", "unavailable", "safety", "inappropriate", "other"];
const MESSAGE_REASONS: ReportReason[] = ["scam", "harassment", "inappropriate", "other"];

type ReportTarget = { type: "listing"; listingId: string; name: string } | { type: "message"; messageId: string; name: string };

/** Report a listing or a message. Admins review reports in the admin console. */
export function ReportDialog({ open, onClose, target }: { open: boolean; onClose: () => void; target: ReportTarget }) {
  const toast = useToast();
  const reasons = target.type === "listing" ? LISTING_REASONS : MESSAGE_REASONS;
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setReason(null);
      setDetails("");
      setError(null);
    }
  }, [open]);

  const submit = async () => {
    if (!reason) {
      setError("Choose what’s wrong.");
      return;
    }
    if (reason === "other" && !details.trim()) {
      setError("Tell us a little about the problem.");
      return;
    }
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const { error: insertError } = await supabase.from("reports").insert({
      target_type: target.type,
      listing_id: target.type === "listing" ? target.listingId : null,
      message_id: target.type === "message" ? target.messageId : null,
      reason,
      details: details.trim() || null,
    });
    setBusy(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    toast.success("Thanks — an admin will review your report.");
    onClose();
  };

  return (
    <Dialog
      description={`Reports are private. ${target.type === "listing" ? "The owner won’t see who reported." : "The other person won’t be told."}`}
      dismissible={!busy}
      footer={
        <>
          <Button disabled={busy} onClick={onClose} variant="secondary">
            Cancel
          </Button>
          <Button loading={busy} onClick={() => void submit()} variant="danger">
            Send report
          </Button>
        </>
      }
      onClose={onClose}
      open={open}
      title={`Report ${target.type === "listing" ? target.name : "this message"}`}
    >
      <div className="report-dialog">
        <RadioCards
          className="report-dialog__reasons"
          label="What’s wrong?"
          name="report-reason"
          onChange={setReason}
          options={reasons.map((value) => ({ value, ...REPORT_REASON_LABELS[value] }))}
          value={reason}
        />
        <Field error={error ?? undefined} label="Details" optional={reason !== "other"}>
          <Textarea maxLength={2000} onChange={(event) => setDetails(event.target.value)} placeholder="What happened? Include dates or amounts if relevant." rows={3} value={details} />
        </Field>
      </div>
    </Dialog>
  );
}
