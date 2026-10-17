import { useEffect, useState } from "react";
import { ArrowLeft, ArrowUpRight, Ban, Check, RotateCcw, X } from "lucide-react";
import { Link } from "react-router-dom";
import { Avatar, Badge, Button, Card, Textarea } from "../../ui";
import { listTime } from "../messaging/time";
import { ReasonBadge } from "./AdminReportsView";
import { targetLabel, type Person, type ReportMessage, type ReportRow } from "./reportsApi";
import "./admin.css";
import "./reports.css";

export type ReportDetailViewProps = {
  report: ReportRow;
  context: ReportMessage[];
  related: number;
  onDecide: (status: "resolved" | "dismissed" | "open", note: string) => Promise<void>;
  onDeactivate: (person: Person) => void;
};

function PersonCard({ title, person, onDeactivate }: { title: string; person: Person | null; onDeactivate?: (person: Person) => void }) {
  return (
    <div className="report-person">
      <p className="v2-eyebrow">{title}</p>
      {person ? (
        <div className="report-person__row">
          <Avatar name={person.full_name ?? person.email} size="sm" />
          <div className="report-person__text">
            <Link to={`/admin/users?q=${encodeURIComponent(person.email ?? person.full_name ?? "")}`}>{person.full_name || "No name"}</Link>
            <span>{person.email ?? "No email"}</span>
          </div>
          {!person.is_active ? (
            <Badge dot tone="red">
              Deactivated
            </Badge>
          ) : (
            onDeactivate && (
              <Button leadingIcon={<Ban />} onClick={() => onDeactivate(person)} size="sm" variant="secondary">
                Deactivate
              </Button>
            )
          )}
        </div>
      ) : (
        <p className="report-person__none">Account removed</p>
      )}
    </div>
  );
}

/** One report: what was reported, by whom, the surrounding messages, and the decision. */
export function ReportDetailView({ report, context, related, onDecide, onDeactivate }: ReportDetailViewProps) {
  const [note, setNote] = useState(report.resolution_note ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => setNote(report.resolution_note ?? ""), [report.id, report.resolution_note]);

  const open = report.status === "open";
  const decide = async (status: "resolved" | "dismissed" | "open") => {
    setBusy(status);
    try {
      await onDecide(status, note);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="report-detail">
      <Link className="report-detail__back" to={open ? "/admin/reports" : `/admin/reports?status=${report.status}`}>
        <ArrowLeft aria-hidden="true" /> All reports
      </Link>

      <header className="report-detail__header">
        <div>
          <p className="v2-eyebrow">
            Report · {report.target_type} · {listTime(report.created_at)}
          </p>
          <h1 className="v2-h1">{targetLabel(report)}</h1>
          <div className="report-detail__meta">
            <ReasonBadge reason={report.reason} />
            {!open && (
              <Badge tone={report.status === "resolved" ? "green" : "gray"}>
                {report.status === "resolved" ? "Resolved" : "Dismissed"} {report.resolved_at ? listTime(report.resolved_at) : ""}
              </Badge>
            )}
            {related > 0 && (
              <Badge tone="clay">
                {related} other {related === 1 ? "report" : "reports"} about this {report.target_type === "listing" ? "listing" : "person"}
              </Badge>
            )}
          </div>
        </div>
      </header>

      <div className="report-detail__layout">
        <div className="report-detail__main">
          <Card className="admin-card" padding="none">
            <header className="admin-card__head">
              <h2>What they said</h2>
            </header>
            <p className="report-detail__quote">{report.details || "No details given."}</p>
          </Card>

          {report.target_type === "listing" && report.listing && (
            <Card className="admin-card" padding="none">
              <header className="admin-card__head">
                <h2>Listing</h2>
                <Link className="review__link" to={`/admin/listings/${report.listing.id}/preview`}>
                  Preview <ArrowUpRight aria-hidden="true" />
                </Link>
              </header>
              <p className="report-detail__quote">
                {report.listing.name} · <span className="report-detail__muted">{report.listing.status.replace("_", " ")}</span>
              </p>
            </Card>
          )}

          {report.target_type === "message" && (
            <Card className="admin-card" padding="none">
              <header className="admin-card__head">
                <h2>Conversation</h2>
                <span className="report-detail__muted">{report.listing?.name}</span>
              </header>
              {context.length === 0 ? (
                <p className="report-detail__quote report-detail__muted">The conversation was deleted.</p>
              ) : (
                <ol className="report-thread">
                  {context.map((message) => (
                    <li
                      className={message.id === report.message_id ? "report-thread__msg report-thread__msg--flagged" : "report-thread__msg"}
                      key={message.id}
                    >
                      <span className="report-thread__who">
                        {message.sender_id === report.reported_user_id ? (report.reported?.full_name ?? "Reported user") : (report.reporter?.full_name ?? "Reporter")}
                        <time>{listTime(message.created_at)}</time>
                      </span>
                      <p>{message.kind === "image" ? "[Photo]" : message.body}</p>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          )}
        </div>

        <aside className="report-detail__side">
          <Card className="admin-card report-people">
            <PersonCard person={report.reporter} title="Reported by" />
            <PersonCard onDeactivate={onDeactivate} person={report.reported} title={report.target_type === "listing" ? "Listing owner" : "Reported user"} />
          </Card>

          <Card className="admin-card" padding="none">
            <header className="admin-card__head">
              <h2>{open ? "Decision" : "Resolution"}</h2>
            </header>
            <div className="review-note">
              <Textarea
                aria-label="Resolution note"
                disabled={!open}
                maxLength={1000}
                onChange={(event) => setNote(event.target.value)}
                placeholder="What you did, e.g. “Archived the listing and warned the owner.” Only admins see this."
                rows={4}
                value={note}
              />
              {open ? (
                <div className="report-detail__actions">
                  <Button disabled={busy !== null} leadingIcon={<X />} loading={busy === "dismissed"} onClick={() => void decide("dismissed")} variant="secondary">
                    Dismiss
                  </Button>
                  <Button disabled={busy !== null} leadingIcon={<Check />} loading={busy === "resolved"} onClick={() => void decide("resolved")}>
                    Mark resolved
                  </Button>
                </div>
              ) : (
                <div className="report-detail__actions">
                  <Button disabled={busy !== null} leadingIcon={<RotateCcw />} loading={busy === "open"} onClick={() => void decide("open")} variant="secondary">
                    Reopen
                  </Button>
                </div>
              )}
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
