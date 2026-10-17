import { useEffect, useRef, useState, type FormEvent } from "react";
import { BadgeCheck, Clock, FileUp, ShieldAlert, X } from "lucide-react";
import { useAuth } from "../../app/AuthProvider";
import { DOC_LABELS, VERIFICATION_DOCUMENT_TYPES, type VerificationDocumentType } from "../../lib/domain";
import { Button, Card, Field, PageHeader, Select, Skeleton, Textarea, useToast } from "../../ui";
import { ACCEPTED_DOC_TYPES, fetchMyVerifications, submitVerification, type Verification } from "./ownerApi";
import "./owner.css";

const dateFmt = new Intl.DateTimeFormat("en-PH", { month: "long", day: "numeric", year: "numeric" });

/** Owner uploads proof of ownership; an admin reviews it in the review queue. */
export default function VerificationPage() {
  const { profile, refreshProfile } = useAuth();
  const toast = useToast();
  const [history, setHistory] = useState<Verification[] | null>(null);
  const [documentType, setDocumentType] = useState<VerificationDocumentType>("land_title");
  const [files, setFiles] = useState<File[]>([]);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () =>
    fetchMyVerifications()
      .then(setHistory)
      .catch(() => setHistory([]));

  useEffect(() => {
    document.title = "Verification · Owner portal · mapaguapa";
    void load();
  }, []);

  const latest = history?.[0];
  const verified = Boolean(profile?.verified_owner_at) || latest?.status === "approved";
  const pending = latest?.status === "pending";
  const canSubmit = !verified && !pending;

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    setFiles((current) => [...current, ...Array.from(list)].slice(0, 5));
    setError(null);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!profile) return;
    if (files.length === 0) {
      setError("Attach at least one photo or PDF.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await submitVerification(profile.id, { documentType, files, note });
      setFiles([]);
      setNote("");
      toast.success("Sent for review. We’ll let you know once an admin checks it.");
      await load();
      await refreshProfile();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Couldn’t send your documents.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="owner-form-page">
      <PageHeader
        eyebrow="Account"
        subtitle="Verified owners get a badge on their listings and in messages, so students know they’re talking to the real owner."
        title="Verification"
      />

      {history === null ? (
        <Skeleton height={120} radius="var(--radius-card-lg)" />
      ) : verified ? (
        <Card>
          <div className="verify-status">
            <span className="verify-status__icon verify-status__icon--approved">
              <BadgeCheck aria-hidden="true" />
            </span>
            <div>
              <h2>You’re a verified owner</h2>
              <p>{profile?.verified_owner_at ? `Verified on ${dateFmt.format(new Date(profile.verified_owner_at))}.` : "Your documents were approved."}</p>
            </div>
          </div>
        </Card>
      ) : pending ? (
        <Card>
          <div className="verify-status">
            <span className="verify-status__icon verify-status__icon--pending">
              <Clock aria-hidden="true" />
            </span>
            <div>
              <h2>Waiting for review</h2>
              <p>
                You sent your {DOC_LABELS[latest.document_type as VerificationDocumentType]?.toLowerCase() ?? "documents"} on{" "}
                {dateFmt.format(new Date(latest.created_at))}. An admin usually checks within a few days.
              </p>
            </div>
          </div>
        </Card>
      ) : (
        latest?.status === "rejected" && (
          <Card>
            <div className="verify-status">
              <span className="verify-status__icon verify-status__icon--rejected">
                <ShieldAlert aria-hidden="true" />
              </span>
              <div>
                <h2>We couldn’t verify your last upload</h2>
                <p>{latest.review_note || "Please send a clearer copy or a different document."}</p>
              </div>
            </div>
          </Card>
        )
      )}

      {canSubmit && history !== null && (
        <Card>
          <form className="owner-form" noValidate onSubmit={submit}>
            <Field hint="Any one of these is enough. Your documents are private — only admins can see them." label="Document type">
              <Select
                onChange={(event) => setDocumentType(event.target.value as VerificationDocumentType)}
                options={VERIFICATION_DOCUMENT_TYPES.map((value) => ({ value, label: DOC_LABELS[value] }))}
                value={documentType}
              />
            </Field>

            <div className="ui-field">
              <span className="ui-field__label">Files</span>
              <label className="file-drop">
                <FileUp aria-hidden="true" />
                <span>
                  <strong>Choose photos or PDFs</strong> — up to 5 files, 10 MB each
                </span>
                <input
                  accept={ACCEPTED_DOC_TYPES.join(",")}
                  className="v2-sr-only"
                  multiple
                  onChange={(event) => {
                    addFiles(event.target.files);
                    event.target.value = "";
                  }}
                  ref={fileRef}
                  type="file"
                />
              </label>
              {files.length > 0 && (
                <ul className="file-list">
                  {files.map((file, index) => (
                    <li key={`${file.name}-${index}`}>
                      <span>{file.name}</span>
                      <Button
                        aria-label={`Remove ${file.name}`}
                        iconOnly
                        onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}
                        size="sm"
                        variant="ghost"
                      >
                        <X />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <Field label="Note for the admin" optional>
              <Textarea maxLength={1000} onChange={(event) => setNote(event.target.value)} placeholder="e.g. The title is under my mother’s name" rows={3} value={note} />
            </Field>

            {error && (
              <p className="ui-field__error" role="alert">
                {error}
              </p>
            )}
            <div className="owner-form__actions">
              <Button loading={busy} type="submit">
                Send for review
              </Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
