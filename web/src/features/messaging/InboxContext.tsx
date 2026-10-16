import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "../../app/AuthProvider";
import { fetchInbox, fetchListingSummaries, subscribeToInbox, type InboxRow, type ListingSummary } from "./messagingApi";

type InboxContextValue = {
  conversations: InboxRow[];
  listings: Map<string, ListingSummary>;
  status: "loading" | "ready" | "error";
  unreadTotal: number;
  refresh: () => Promise<void>;
  /** Optimistically clear a conversation's unread count (before the RPC round-trip). */
  markSeen: (conversationId: string) => void;
};

const InboxContext = createContext<InboxContextValue | null>(null);

/** Conversations for the signed-in student or owner, kept fresh with Realtime. */
export function InboxProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const [conversations, setConversations] = useState<InboxRow[]>([]);
  const [listings, setListings] = useState<Map<string, ListingSummary>>(new Map());
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const timer = useRef<number | undefined>(undefined);

  const refresh = useCallback(async () => {
    try {
      const rows = await fetchInbox();
      setConversations(rows);
      setStatus("ready");
      const ids = rows.map((row) => row.listing_id).filter((id): id is string => Boolean(id));
      setListings(await fetchListingSummaries(ids));
    } catch {
      setStatus((current) => (current === "ready" ? current : "error"));
    }
  }, []);

  useEffect(() => {
    if (!profile) return undefined;
    void refresh();
    // Bursts of events (a visit RPC writes several rows) collapse into one refresh.
    const unsubscribe = subscribeToInbox(() => {
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void refresh(), 300);
    });
    return () => {
      window.clearTimeout(timer.current);
      unsubscribe();
    };
  }, [profile, refresh]);

  const markSeen = useCallback((conversationId: string) => {
    setConversations((rows) => rows.map((row) => (row.id === conversationId ? { ...row, unread_count: 0 } : row)));
  }, []);

  const value = useMemo<InboxContextValue>(
    () => ({
      conversations,
      listings,
      status,
      unreadTotal: conversations.reduce((sum, row) => sum + (row.unread_count ?? 0), 0),
      refresh,
      markSeen,
    }),
    [conversations, listings, status, refresh, markSeen]
  );

  return <InboxContext.Provider value={value}>{children}</InboxContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useInbox() {
  const context = useContext(InboxContext);
  if (!context) throw new Error("useInbox must be used inside <InboxProvider>.");
  return context;
}

