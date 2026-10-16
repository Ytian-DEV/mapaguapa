/** The 8 listing wizard steps (frame O2). `draft_step` stores the 1-based index. */
export const WIZARD_STEPS = [
  { key: "basics", label: "Basics" },
  { key: "rooms", label: "Rooms & pricing" },
  { key: "bills", label: "Bills & utilities" },
  { key: "comfort", label: "Comfort & amenities" },
  { key: "rules", label: "Rules & safety" },
  { key: "location", label: "Location" },
  { key: "photos", label: "Photos" },
  { key: "review", label: "Review & submit" },
] as const;

export type WizardStepKey = (typeof WIZARD_STEPS)[number]["key"];

export function stepKeyAt(step: number | null | undefined): WizardStepKey {
  const index = Math.min(Math.max((step ?? 1) - 1, 0), WIZARD_STEPS.length - 1);
  return WIZARD_STEPS[index].key;
}

export function editPath(base: "/owner" | "/admin", listingId: string, step?: WizardStepKey) {
  return `${base}/listings/${listingId}/edit${step ? `/${step}` : ""}`;
}
