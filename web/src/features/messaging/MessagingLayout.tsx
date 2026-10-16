import type { ReactNode } from "react";
import { MessageSquare } from "lucide-react";
import { EmptyState, cx } from "../../ui";
import "./messaging.css";

type MessagingLayoutProps = {
  list: ReactNode;
  thread: ReactNode | null;
  aside: ReactNode | null;
  emptyTitle: string;
  emptyDescription: string;
  className?: string;
};

/**
 * Three-column workspace shared by student Messages (04) and owner Inquiries (O3).
 * Below 1024px only the list or the open thread is shown; the details column
 * moves into a drawer below 1280px (the page provides the drawer).
 */
export function MessagingLayout({ list, thread, aside, emptyTitle, emptyDescription, className }: MessagingLayoutProps) {
  return (
    <div className={cx("messaging", thread ? "messaging--thread-open" : "messaging--list-only", className)}>
      <div className="messaging__list">{list}</div>
      <div className="messaging__thread">
        {thread ?? <EmptyState description={emptyDescription} icon={<MessageSquare />} title={emptyTitle} />}
      </div>
      {aside && <aside className="messaging__aside">{aside}</aside>}
    </div>
  );
}
