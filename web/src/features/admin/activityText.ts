import type { ActivityWithActor } from "./adminApi";

const ROLE_LABELS: Record<string, string> = { student: "student", owner: "owner", admin: "admin" };

function meta(row: ActivityWithActor) {
  return (row.meta && typeof row.meta === "object" && !Array.isArray(row.meta) ? row.meta : {}) as Record<string, unknown>;
}

/** One readable line per activity_log row: "You restored “GMB Dormitory” from archive". */
export function activityText(row: ActivityWithActor, meId: string | null) {
  const who = row.actor_id && row.actor_id === meId ? "You" : row.actor_name || (row.actor_id ? "Someone" : "The system");
  const thing = row.summary ? `“${row.summary}”` : "a listing";
  const m = meta(row);

  switch (row.action) {
    case "listing.created":
      return `${who} started a listing ${thing}`;
    case "listing.in_review":
      return `${who} submitted ${thing} for review`;
    case "listing.published":
      return m.from === "archived" ? `${who} restored ${thing} from archive` : `${who} published ${thing}`;
    case "listing.changes_requested":
      return `${who} requested changes on ${thing}`;
    case "listing.archived":
      return `${who} archived ${thing}`;
    case "listing.draft":
      return `${who} moved ${thing} back to draft`;
    case "user.role_changed":
      return `${who} changed ${row.summary ?? "a user"}’s role to ${ROLE_LABELS[String(m.to)] ?? String(m.to)}`;
    case "user.deactivated":
      return `${who} deactivated ${row.summary ?? "an account"}`;
    case "user.reactivated":
      return `${who} reactivated ${row.summary ?? "an account"}`;
    case "user.verified":
      return `${row.summary ?? "An owner"} is now a verified owner`;
    case "user.unverified":
      return `${row.summary ?? "An owner"} lost verified status`;
    case "user.merged":
      return `${who} merged a duplicate into ${row.summary ?? "an account"}`;
    case "verification.submitted":
      return `${who} sent ownership documents`;
    case "verification.approved":
      return `${who} approved an ownership verification`;
    case "verification.rejected":
      return `${who} rejected an ownership verification`;
    case "report.created":
      return `New report: ${String(row.summary ?? "").replace(/_/g, " ")}`;
    case "report.resolved":
      return `${who} resolved a report`;
    case "report.dismissed":
      return `${who} dismissed a report`;
    default:
      return `${who}: ${row.action.replace(/[._]/g, " ")}`;
  }
}

/** Where clicking an activity row should go. */
export function activityHref(row: ActivityWithActor) {
  if (row.entity_type === "listing" && row.entity_id) return `/admin/listings?focus=${row.entity_id}`;
  if (row.entity_type === "user") return "/admin/users";
  if (row.entity_type === "report") return "/admin/reports";
  if (row.entity_type === "verification") return "/admin/review?tab=verifications";
  return null;
}
