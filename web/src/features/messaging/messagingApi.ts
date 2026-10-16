import type { RealtimeChannel } from "@supabase/supabase-js";
import type { Tables, Views } from "../../lib/database";
import type { InquiryStatus } from "../../lib/domain";
import { STORAGE } from "../../lib/domain";
import { supabase } from "../../lib/supabase";

export type InboxRow = Views<"inbox"> & { id: string };
export type Message = Tables<"messages">;
export type VisitRequest = Tables<"visit_requests">;
export type SavedReply = Tables<"saved_replies">;

export type ListingSummary = Pick<
  Views<"listing_rows">,
  | "name"
  | "area"
  | "accommodation_type"
  | "price_band"
  | "monthly_rental_label"
  | "rooms_total"
  | "rooms_available"
  | "exclusivity_group"
  | "curfew"
  | "has_curfew"
  | "cover_bucket"
  | "cover_path"
> & { id: string };

function client() {
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

// ---------------------------------------------------------------------------
// Inbox
// ---------------------------------------------------------------------------
export async function fetchInbox(): Promise<InboxRow[]> {
  const { data, error } = await client().from("inbox").select("*").order("last_message_at", { ascending: false, nullsFirst: false });
  if (error) throw error;
  return (data ?? []).filter((row): row is InboxRow => Boolean(row.id));
}

export async function fetchListingSummaries(ids: string[]): Promise<Map<string, ListingSummary>> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return new Map();
  const { data, error } = await client()
    .from("listing_rows")
    .select("id, name, area, accommodation_type, price_band, monthly_rental_label, rooms_total, rooms_available, exclusivity_group, curfew, has_curfew, cover_bucket, cover_path")
    .in("id", unique);
  if (error) throw error;
  return new Map((data ?? []).filter((row) => row.id).map((row) => [row.id as string, row as ListingSummary]));
}

// ---------------------------------------------------------------------------
// Thread
// ---------------------------------------------------------------------------
export async function fetchThread(conversationId: string) {
  const [messages, visits] = await Promise.all([
    client().from("messages").select("*").eq("conversation_id", conversationId).order("created_at", { ascending: true }),
    client().from("visit_requests").select("*").eq("conversation_id", conversationId).order("created_at", { ascending: true }),
  ]);
  if (messages.error) throw messages.error;
  if (visits.error) throw visits.error;
  return { messages: messages.data ?? [], visits: visits.data ?? [] };
}

export async function sendText(conversationId: string, body: string) {
  const { data, error } = await client()
    .from("messages")
    .insert({ conversation_id: conversationId, body: body.trim(), kind: "text" })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export async function sendImage(conversationId: string, file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Only photos can be attached.");
  if (file.size > MAX_IMAGE_BYTES) throw new Error("Photos must be 8 MB or smaller.");
  const extension = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = STORAGE.messageAttachmentPath(conversationId, `${crypto.randomUUID()}.${extension}`);
  const upload = await client().storage.from(STORAGE.messageAttachments).upload(path, file, { contentType: file.type, upsert: false });
  if (upload.error) throw upload.error;
  const { data, error } = await client()
    .from("messages")
    .insert({ conversation_id: conversationId, kind: "image", attachment_path: path })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

/** Private bucket: short-lived URLs for the attachments in view. */
export async function signAttachments(paths: string[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(paths));
  if (unique.length === 0) return new Map();
  const { data, error } = await client().storage.from(STORAGE.messageAttachments).createSignedUrls(unique, 60 * 60);
  if (error) throw error;
  return new Map((data ?? []).filter((item) => item.signedUrl && item.path).map((item) => [item.path as string, item.signedUrl]));
}

export async function markRead(conversationId: string) {
  await client().rpc("mark_conversation_read", { p_conversation_id: conversationId });
}

export async function setInquiryStatus(conversationId: string, status: InquiryStatus) {
  const { error } = await client().rpc("set_inquiry_status", { p_conversation_id: conversationId, p_status: status });
  if (error) throw error;
}

export async function setBlocked(conversationId: string, blocked: boolean) {
  const { error } = await client().rpc("set_conversation_blocked", { p_conversation_id: conversationId, p_blocked: blocked });
  if (error) throw error;
}

export async function requestVisit(conversationId: string, at: Date, note?: string) {
  const { error } = await client().rpc("request_visit", { p_conversation_id: conversationId, p_at: at.toISOString(), p_note: note ?? undefined });
  if (error) throw error;
}

export type VisitAction = "confirm" | "decline" | "reschedule" | "cancel";

export async function respondVisit(visitId: string, action: VisitAction, newAt?: Date) {
  const { error } = await client().rpc("respond_visit", { p_visit_id: visitId, p_action: action, p_new_at: newAt?.toISOString() });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Owner tools
// ---------------------------------------------------------------------------
export async function fetchNote(conversationId: string) {
  const { data, error } = await client().from("conversation_notes").select("note").eq("conversation_id", conversationId).maybeSingle();
  if (error) throw error;
  return data?.note ?? "";
}

export async function saveNote(conversationId: string, ownerId: string, note: string) {
  const { error } = await client()
    .from("conversation_notes")
    .upsert({ conversation_id: conversationId, owner_id: ownerId, note, updated_at: new Date().toISOString() }, { onConflict: "conversation_id" });
  if (error) throw error;
}

export async function fetchSavedReplies(): Promise<SavedReply[]> {
  const { data, error } = await client().from("saved_replies").select("*").order("sort_order").order("created_at");
  if (error) throw error;
  return data ?? [];
}

export async function addSavedReply(ownerId: string, body: string, sortOrder: number) {
  const { data, error } = await client().from("saved_replies").insert({ owner_id: ownerId, body: body.trim(), sort_order: sortOrder }).select("*").single();
  if (error) throw error;
  return data;
}

export async function deleteSavedReply(id: string) {
  const { error } = await client().from("saved_replies").delete().eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Realtime (RLS applies: users only receive rows they can read)
// ---------------------------------------------------------------------------
export function subscribeToThread(
  conversationId: string,
  handlers: { onMessage: (message: Message) => void; onVisit: (visit: VisitRequest) => void; onConversation: () => void }
): () => void {
  const channel: RealtimeChannel = client()
    .channel(`thread:${conversationId}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` }, (payload) =>
      handlers.onMessage(payload.new as Message)
    )
    .on("postgres_changes", { event: "*", schema: "public", table: "visit_requests", filter: `conversation_id=eq.${conversationId}` }, (payload) =>
      handlers.onVisit(payload.new as VisitRequest)
    )
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "conversations", filter: `id=eq.${conversationId}` }, () =>
      handlers.onConversation()
    )
    .subscribe();
  return () => {
    void client().removeChannel(channel);
  };
}

/** Any new message or conversation change the user can see (inbox and unread badges). */
export function subscribeToInbox(onChange: () => void): () => void {
  const channel = client()
    .channel(`inbox:${crypto.randomUUID()}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => onChange())
    .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => onChange())
    .subscribe();
  return () => {
    void client().removeChannel(channel);
  };
}

/** Phone number for the Call button (listings are readable by participants while published). */
export async function fetchListingContact(listingId: string) {
  const { data, error } = await client().from("listings").select("contact_number").eq("id", listingId).maybeSingle();
  if (error) throw error;
  return data?.contact_number ?? null;
}
