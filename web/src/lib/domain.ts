// Literal unions for values the database restricts with check constraints.
// The generated database.ts types these columns as plain `string`.

export const ROLES = ["student", "owner", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const LISTING_STATUSES = ["draft", "in_review", "changes_requested", "published", "archived"] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const PRICE_BANDS = ["under_1000", "1000_1999", "2000_2999", "3000_plus"] as const;
export type PriceBand = (typeof PRICE_BANDS)[number];

/** Same labels the database writes to monthly_rental_label (app.price_band_label). */
export const PRICE_BAND_LABELS: Record<PriceBand, string> = {
  under_1000: "Under ₱1,000",
  "1000_1999": "₱1,000–1,999",
  "2000_2999": "₱2,000–2,999",
  "3000_plus": "₱3,000+",
};

/** Mirrors app.price_band_for() so forms can preview the band before saving. */
export function priceBandFor(amount: number | null | undefined): PriceBand | null {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return null;
  if (amount < 1000) return "under_1000";
  if (amount < 2000) return "1000_1999";
  if (amount < 3000) return "2000_2999";
  return "3000_plus";
}

export const INQUIRY_STATUSES = ["new", "replied", "visit_scheduled", "closed"] as const;
export type InquiryStatus = (typeof INQUIRY_STATUSES)[number];

export const VISIT_STATUSES = ["pending", "confirmed", "declined", "rescheduled", "cancelled"] as const;
export type VisitStatus = (typeof VISIT_STATUSES)[number];

export const REPORT_REASONS = ["scam", "wrong_info", "unavailable", "inappropriate", "harassment", "safety", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_STATUSES = ["open", "resolved", "dismissed"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const VERIFICATION_DOCUMENT_TYPES = [
  "land_title",
  "tax_declaration",
  "business_permit",
  "barangay_certificate",
  "lease_contract",
  "other",
] as const;
export type VerificationDocumentType = (typeof VERIFICATION_DOCUMENT_TYPES)[number];

export const DOC_LABELS: Record<VerificationDocumentType, string> = {
  land_title: "Land title",
  tax_declaration: "Tax declaration",
  business_permit: "Business / mayor’s permit",
  barangay_certificate: "Barangay certificate",
  lease_contract: "Lease contract (if you rent and sublet)",
  other: "Other proof of ownership",
};

/** Storage layout used by the v2 policies. */
export const STORAGE = {
  listingPhotos: "listing-photos",
  messageAttachments: "message-attachments",
  ownerVerifications: "owner-verifications",
  ownerListingPhotoPath: (listingId: string, fileName: string) => `owner/${listingId}/${fileName}`,
  adminListingPhotoPath: (listingId: string, fileName: string) => `admin/${listingId}/${fileName}`,
  messageAttachmentPath: (conversationId: string, fileName: string) => `${conversationId}/${fileName}`,
  verificationPath: (ownerId: string, fileName: string) => `${ownerId}/${fileName}`,
} as const;
