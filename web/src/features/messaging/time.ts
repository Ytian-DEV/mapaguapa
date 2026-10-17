const time = new Intl.DateTimeFormat("en-PH", { hour: "numeric", minute: "2-digit" });
const shortDate = new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric" });
const visitDate = new Intl.DateTimeFormat("en-PH", { weekday: "short", month: "short", day: "numeric" });

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function daysAgo(date: Date, now = new Date()) {
  return Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
}

/** Conversation list: "8:42 PM", "Yesterday", "Oct 12". */
export function listTime(iso: string | null | undefined) {
  if (!iso) return "";
  const date = new Date(iso);
  const days = daysAgo(date);
  if (days === 0) return time.format(date);
  if (days === 1) return "Yesterday";
  return shortDate.format(date);
}

/** Separator between days in a thread: "Today", "Yesterday", "Mon, Oct 12". */
export function dayLabel(iso: string) {
  const date = new Date(iso);
  const days = daysAgo(date);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return visitDate.format(date);
}

export function messageTime(iso: string) {
  return time.format(new Date(iso));
}

/** Visit card: "Sat, Oct 24 · 9:00 AM". */
export function visitLabel(iso: string) {
  const date = new Date(iso);
  return `${visitDate.format(date)} · ${time.format(date)}`;
}

export function sameDay(a: string, b: string) {
  return startOfDay(new Date(a)) === startOfDay(new Date(b));
}

/** Value for <input type="datetime-local"> in local time. */
export function toLocalInputValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
