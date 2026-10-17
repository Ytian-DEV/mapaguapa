import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../../app/AuthProvider";
import { useToast } from "../../ui";
import { useInbox } from "./InboxContext";
import {
  fetchThread,
  markRead,
  requestVisit,
  respondVisit,
  sendImage,
  sendText,
  signAttachments,
  subscribeToThread,
  type Message,
  type VisitAction,
  type VisitRequest,
} from "./messagingApi";
import { reportError } from "../../lib/errors";

export type ThreadState = {
  status: "loading" | "ready" | "error";
  messages: Message[];
  visits: Map<string, VisitRequest>;
  attachmentUrls: Map<string, string>;
  sending: boolean;
  send: (body: string) => Promise<boolean>;
  attach: (file: File) => Promise<void>;
  proposeVisit: (at: Date, note?: string) => Promise<boolean>;
  actOnVisit: (visitId: string, action: VisitAction, newAt?: Date) => Promise<boolean>;
  reload: () => void;
};

function upsertMessage(list: Message[], message: Message) {
  if (list.some((item) => item.id === message.id)) return list;
  return [...list, message].sort((a, b) => a.created_at.localeCompare(b.created_at));
}

/** Messages, visits and attachments for one conversation, live via Realtime. */
export function useThread(conversationId: string | null): ThreadState {
  const { profile } = useAuth();
  const { refresh, markSeen } = useInbox();
  const toast = useToast();
  const [status, setStatus] = useState<ThreadState["status"]>("loading");
  const [messages, setMessages] = useState<Message[]>([]);
  const [visits, setVisits] = useState<Map<string, VisitRequest>>(new Map());
  const [attachmentUrls, setAttachmentUrls] = useState<Map<string, string>>(new Map());
  const [sending, setSending] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const myId = profile?.id;
  const signedPaths = useRef(new Set<string>());

  const read = useCallback(
    (id: string) => {
      markSeen(id);
      void markRead(id).then(() => refresh(), () => undefined);
    },
    [markSeen, refresh]
  );

  useEffect(() => {
    if (!conversationId) return undefined;
    let cancelled = false;
    setStatus("loading");
    setMessages([]);
    setVisits(new Map());
    fetchThread(conversationId)
      .then((thread) => {
        if (cancelled) return;
        setMessages(thread.messages);
        setVisits(new Map(thread.visits.map((visit) => [visit.id, visit])));
        setStatus("ready");
        read(conversationId);
      })
      .catch((error) => {
        reportError(error);
        if (!cancelled) setStatus("error");
      });

    const unsubscribe = subscribeToThread(conversationId, {
      onMessage: (message) => {
        setMessages((current) => upsertMessage(current, message));
        if (message.sender_id !== myId) read(conversationId);
      },
      onVisit: (visit) => setVisits((current) => new Map(current).set(visit.id, visit)),
      onConversation: () => void refresh(),
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [conversationId, myId, read, refresh, reloadToken]);

  // Sign any image attachments we haven't signed yet.
  useEffect(() => {
    const missing = messages
      .map((message) => message.attachment_path)
      .filter((path): path is string => Boolean(path) && !signedPaths.current.has(path as string));
    if (missing.length === 0) return;
    missing.forEach((path) => signedPaths.current.add(path));
    signAttachments(missing)
      .then((urls) => setAttachmentUrls((current) => new Map([...current, ...urls])))
      .catch(() => missing.forEach((path) => signedPaths.current.delete(path)));
  }, [messages]);

  const send = useCallback(
    async (body: string) => {
      if (!conversationId || !body.trim()) return false;
      setSending(true);
      try {
        const message = await sendText(conversationId, body);
        setMessages((current) => upsertMessage(current, message));
        void refresh();
        return true;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Message not sent. Try again.");
        return false;
      } finally {
        setSending(false);
      }
    },
    [conversationId, refresh, toast]
  );

  const attach = useCallback(
    async (file: File) => {
      if (!conversationId) return;
      setSending(true);
      try {
        const message = await sendImage(conversationId, file);
        setMessages((current) => upsertMessage(current, message));
        void refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Photo not sent. Try again.");
      } finally {
        setSending(false);
      }
    },
    [conversationId, refresh, toast]
  );

  const reloadThread = useCallback(async () => {
    if (!conversationId) return;
    const thread = await fetchThread(conversationId);
    setMessages(thread.messages);
    setVisits(new Map(thread.visits.map((visit) => [visit.id, visit])));
  }, [conversationId]);

  const proposeVisit = useCallback(
    async (at: Date, note?: string) => {
      if (!conversationId) return false;
      try {
        await requestVisit(conversationId, at, note);
        await reloadThread();
        void refresh();
        return true;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Couldn’t send the visit request.");
        return false;
      }
    },
    [conversationId, refresh, reloadThread, toast]
  );

  const actOnVisit = useCallback(
    async (visitId: string, action: VisitAction, newAt?: Date) => {
      try {
        await respondVisit(visitId, action, newAt);
        await reloadThread();
        void refresh();
        return true;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Couldn’t update the visit.");
        return false;
      }
    },
    [refresh, reloadThread, toast]
  );

  return {
    status,
    messages,
    visits,
    attachmentUrls,
    sending,
    send,
    attach,
    proposeVisit,
    actOnVisit,
    reload: () => setReloadToken((value) => value + 1),
  };
}
