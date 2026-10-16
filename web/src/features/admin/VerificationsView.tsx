import { useState } from "react";
import { BadgeCheck, FileText } from "lucide-react";
import { DOC_LABELS, type VerificationDocumentType } from "../../lib/domain";
import { Avatar, Button, Card, ConfirmDialog, EmptyState, Field, Textarea } from "../../ui";
import { listTime } from "../messaging/time";
import type { Verification } from "./reviewApi";

type VerificationsViewProps = {
  items: Verification[];
  /** Signed URLs keyed by storage path; missing paths show as unavailable. */
  links: Map<string, string>;
  onDecide: (item: Verification, decision: "approved" | "rejected", note: string) => Promise<void>;
};

function fileName(path: string) {
  return path.split("/").pop()?.replace(/^\d+-/, "") || "Document";
}

/** Owner proof-of-ownership submissions waiting for an admin. */
export function VerificationsView({ items, links, onDecide }: VerificationsViewProps) {
  const [rejecting, setRejecting] = useState<Verification | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const decide = async (item: Verification, decision: "approved" | "rejected", reason = "") => {
    setBusy(item.id);
    try {
      await onDecide(item, decision, reason);
      setRejecting(null);
    } finally {
      setBusy(null);
    }
  };

  if (items.length === 0) {
    return <EmptyState description="Owners who upload proof of ownership show up here." icon={<BadgeCheck />} title="No verifications waiting" />;
  }

  return (
    <div className="verify-list">
      {items.map((item) => (
        <Card className="verify-item" key={item.id}>
          <div className="verify-item__head">
            <div className="verify-item__who">
              <Avatar name={item.owner_name ?? item.owner_email ?? "Owner"} />
              <div>
                <p>{item.owner_name || "Unnamed owner"}</p>
                <span>
                  {item.owner_email ?? "No email"} · sent {listTime(item.created_at)}
                </span>
              </div>
            </div>
            <span className="v2-eyebrow">{DOC_LABELS[item.document_type as VerificationDocumentType] ?? item.document_type}</span>
          </div>
          {item.note && <p className="review__description">{item.note}</p>}
          <div className="verify-item__files">
            {item.document_paths.map((path) =>
              links.get(path) ? (
                <a href={links.get(path)} key={path} rel="noreferrer" target="_blank">
                  <FileText aria-hidden="true" /> {fileName(path)}
                </a>
              ) : (
                <span className="verify-item__missing" key={path}>
                  <FileText aria-hidden="true" /> {fileName(path)} (unavailable)
                </span>
              )
            )}
          </div>
          <div className="verify-item__actions">
            <Button
              disabled={busy !== null}
              onClick={() => {
                setNote("");
                setRejecting(item);
              }}
              variant="secondary"
            >
              Reject
            </Button>
            <Button leadingIcon={<BadgeCheck />} loading={busy === item.id && !rejecting} onClick={() => void decide(item, "approved")}>
              Approve owner
            </Button>
          </div>
        </Card>
      ))}

      <ConfirmDialog
        busy={rejecting !== null && busy === rejecting.id}
        confirmDisabled={note.trim().length < 5}
        confirmLabel="Reject"
        description="The owner sees your reason and can upload new documents."
        destructive
        onCancel={() => setRejecting(null)}
        onConfirm={() => rejecting && void decide(rejecting, "rejected", note)}
        open={rejecting !== null}
        title={`Reject ${rejecting?.owner_name ?? "this owner"}’s documents?`}
      >
        <Field label="Reason">
          <Textarea maxLength={500} onChange={(event) => setNote(event.target.value)} placeholder="e.g. The name on the tax declaration doesn’t match." rows={3} value={note} />
        </Field>
      </ConfirmDialog>
    </div>
  );
}
