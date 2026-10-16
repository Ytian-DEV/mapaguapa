import type { ReactNode } from "react";
import { Info, Pencil, Plus, Trash2 } from "lucide-react";
import { PRICE_BAND_LABELS, priceBandFor } from "../../lib/domain";
import { Button, Checkbox, Chip, Field, Input, NumberStepper, RadioCards, Segmented, Select, Textarea, Toggle } from "../../ui";
import {
  ACCOMMODATION_TYPES,
  ADVANCE_DEPOSIT_OPTIONS,
  BILL_ITEMS,
  EXCLUSIVITY_VALUES,
  SIGNAL_OPTIONS,
  roomTypes,
  splitList,
  type RoomType,
  type WizardForm,
} from "./wizardModel";

export type StepProps = {
  form: WizardForm;
  setField: <K extends keyof WizardForm>(field: K, value: WizardForm[K]) => void;
  setFields: (patch: Partial<WizardForm>) => void;
  errors?: Partial<Record<keyof WizardForm, string>>;
};

const toNumber = (value: string) => {
  const cleaned = value.replace(/[^\d.]/g, "");
  return cleaned ? Number(cleaned) : null;
};

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="wizard-section">
      <div className="wizard-section__head">
        <h2>{title}</h2>
        {hint && <p>{hint}</p>}
      </div>
      {children}
    </section>
  );
}

// ---------------------------------------------------------------------------
// 1. Basics
// ---------------------------------------------------------------------------
export function BasicsStep({ form, setField, errors }: StepProps) {
  return (
    <>
      <Section hint="Students search by name and barangay." title="About the place">
        <Field error={errors?.name} label="Listing name">
          <Input maxLength={120} onChange={(event) => setField("name", event.target.value)} placeholder="e.g. Sunrise Boarding House" value={form.name ?? ""} />
        </Field>
        <div className="wizard-grid">
          <Field label="Type">
            <Select onChange={(event) => setField("accommodation_type", event.target.value)} options={ACCOMMODATION_TYPES.map((value) => ({ value, label: value }))} value={form.accommodation_type || "Boarding House"} />
          </Field>
          {form.accommodation_type === "Others" && (
            <Field label="What kind of place?">
              <Input onChange={(event) => setField("accommodation_type_other", event.target.value)} value={form.accommodation_type_other ?? ""} />
            </Field>
          )}
        </div>
        <Field error={errors?.address} hint="Start with the barangay, e.g. “Guadalupe, Baybay City, Leyte”." label="Address">
          <Input onChange={(event) => setField("address", event.target.value)} placeholder="Barangay, street, Baybay City, Leyte" value={form.address ?? ""} />
        </Field>
        <Field hint="What makes it a good place to stay? Mention distance to campus, rooms and anything included." label="Description" optional>
          <Textarea maxLength={2000} onChange={(event) => setField("description", event.target.value || null)} rows={5} value={form.description ?? ""} />
        </Field>
        <div className="wizard-grid">
          <Field label="Floors">
            <NumberStepper label="floors" max={20} min={1} onChange={(value) => setField("floor_count", value)} value={form.floor_count ?? 1} />
          </Field>
          <div className="wizard-inline">
            <Toggle checked={form.is_fenced === true} label="Fenced property" onChange={(event) => setField("is_fenced", event.target.checked)} />
          </div>
        </div>
      </Section>

      <Section hint="Shown on your listing so students can call or text you." title="Contact">
        <div className="wizard-grid">
          <Field label="Contact person">
            <Input autoComplete="name" onChange={(event) => setField("contact_person", event.target.value || null)} value={form.contact_person ?? ""} />
          </Field>
          <Field error={errors?.contact_number} label="Mobile number">
            <Input autoComplete="tel" inputMode="tel" onChange={(event) => setField("contact_number", event.target.value || null)} placeholder="09XX XXX XXXX" value={form.contact_number ?? ""} />
          </Field>
        </div>
        <Field label="Other contact (Facebook page, landline)" optional>
          <Input onChange={(event) => setField("other_contact_information", event.target.value || null)} value={form.other_contact_information ?? ""} />
        </Field>
      </Section>
    </>
  );
}

// ---------------------------------------------------------------------------
// 2. Rooms & pricing (frame O2)
// ---------------------------------------------------------------------------
const OCCUPANCY = [
  { value: "1-1", label: "1 (solo room)" },
  { value: "1-2", label: "1 to 2" },
  { value: "1-4", label: "1 to 4" },
  { value: "2-4", label: "2 to 4" },
  { value: "4-6", label: "4 to 6" },
  { value: "6-10", label: "6 or more" },
];

function RoomTypesEditor({ form, setField }: StepProps) {
  const list = roomTypes(form);
  const update = (next: RoomType[]) => setField("room_types", next as unknown as WizardForm["room_types"]);
  const change = (index: number, patch: Partial<RoomType>) => update(list.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  return (
    <div className="room-types">
      {list.map((item, index) => (
        <div className="room-type" key={index}>
          <Pencil aria-hidden="true" className="room-type__icon" />
          <Input aria-label="Room type name" onChange={(event) => change(index, { label: event.target.value })} placeholder="Room for 2" value={item.label} />
          <Input
            aria-label="Rent per person"
            inputMode="numeric"
            leadingIcon={<span>₱</span>}
            onChange={(event) => change(index, { rent: toNumber(event.target.value) })}
            placeholder="3,000"
            trailing={<span>/ person</span>}
            value={item.rent ?? ""}
          />
          <Input aria-label="Rooms available" inputMode="numeric" onChange={(event) => change(index, { available: toNumber(event.target.value) })} placeholder="Available" value={item.available ?? ""} />
          <Button aria-label={`Remove ${item.label || "room type"}`} iconOnly onClick={() => update(list.filter((_, i) => i !== index))} size="sm" variant="ghost">
            <Trash2 />
          </Button>
        </div>
      ))}
      {list.length < 8 && (
        <button className="room-types__add" onClick={() => update([...list, { label: "", capacity: null, rent: null, available: null }])} type="button">
          <Plus aria-hidden="true" /> Add room type
        </button>
      )}
    </div>
  );
}

export function RoomsStep(props: StepProps) {
  const { form, setField, setFields, errors } = props;
  const band = priceBandFor(form.rent_exact !== null ? Number(form.rent_exact) : null);
  const occupancy = form.occupancy_min && form.occupancy_max ? `${form.occupancy_min}-${form.occupancy_max}` : "";

  return (
    <>
      <Section hint="Students filter by this first." title="Who can stay?">
        <RadioCards
          label="Who can stay?"
          name="exclusivity"
          onChange={(value) => setField("exclusivity", value)}
          options={EXCLUSIVITY_VALUES.map((item) => ({ value: item.value, label: item.label, description: item.description }))}
          value={(EXCLUSIVITY_VALUES.find((item) => item.value === form.exclusivity)?.value ?? null) as "Female" | "Male" | "Mixed" | null}
        />
      </Section>

      <Section hint="Enter the exact amount — we’ll show students the matching price range." title="Rent">
        <div className="wizard-grid">
          <Field error={errors?.rent_exact} label="Monthly rent per person">
            <Input
              inputMode="numeric"
              leadingIcon={<span>₱</span>}
              onChange={(event) => setField("rent_exact", toNumber(event.target.value))}
              placeholder="2,800"
              trailing={<span>/ month</span>}
              value={form.rent_exact ?? ""}
            />
          </Field>
          <Field label="Advance & deposit">
            <Select
              onChange={(event) => setField("advance_deposit", event.target.value || null)}
              options={ADVANCE_DEPOSIT_OPTIONS.map((value) => ({ value, label: value }))}
              placeholder="Choose…"
              value={form.advance_deposit ?? ""}
            />
          </Field>
        </div>
        {band && (
          <p className="wizard-hint">
            <Info aria-hidden="true" />
            Students will see this as {PRICE_BAND_LABELS[band]} / month in search results.
          </p>
        )}
      </Section>

      <Section title="Rooms">
        <div className="wizard-grid wizard-grid--4">
          <Field label="Total rooms">
            <NumberStepper label="total rooms" max={200} min={0} onChange={(value) => setFields({ rooms_total: value, rooms_available: Math.min(form.rooms_available ?? value, value) })} value={form.rooms_total ?? 0} />
          </Field>
          <Field label="Available now">
            <NumberStepper label="available rooms" max={form.rooms_total ?? 200} min={0} onChange={(value) => setField("rooms_available", value)} value={form.rooms_available ?? 0} />
          </Field>
          <Field label="Floors">
            <NumberStepper label="floors" max={20} min={1} onChange={(value) => setField("floor_count", value)} value={form.floor_count ?? 1} />
          </Field>
          <Field label="People per room">
            <Select
              onChange={(event) => {
                const [min, max] = event.target.value.split("-").map(Number);
                setFields({ occupancy_min: min || null, occupancy_max: max || null });
              }}
              options={OCCUPANCY}
              placeholder="Choose…"
              value={occupancy}
            />
          </Field>
        </div>
      </Section>

      <Section hint="Optional — add these if prices differ by room size." title="Room types">
        <RoomTypesEditor {...props} />
      </Section>
    </>
  );
}

// ---------------------------------------------------------------------------
// 3. Bills & utilities
// ---------------------------------------------------------------------------
type BillState = "included" | "separate" | "none";

export function BillsStep({ form, setFields, setField }: StepProps) {
  const included = splitList(form.bills_included);
  const separate = splitList(form.bills_not_included);
  const stateOf = (item: string): BillState => (included.includes(item) ? "included" : separate.includes(item) ? "separate" : "none");

  const setBill = (item: string, state: BillState) => {
    const nextIncluded = included.filter((value) => value !== item);
    const nextSeparate = separate.filter((value) => value !== item);
    if (state === "included") nextIncluded.push(item);
    if (state === "separate") nextSeparate.push(item);
    setFields({
      bills_included: nextIncluded.join(", ") || null,
      bills_not_included: nextSeparate.join(", ") || null,
      utilities_included: nextIncluded.length > 0,
    });
  };

  const signals = form.cellular_signals ?? [];
  const toggleSignal = (signal: string) =>
    setField("cellular_signals", signals.includes(signal) ? signals.filter((value) => value !== signal) : [...signals, signal]);

  return (
    <>
      <Section hint="Students compare the real monthly cost, not just rent." title="Bills">
        <div className="bill-rows">
          {BILL_ITEMS.map((item) => (
            <div className="bill-row" key={item}>
              <span>{item}</span>
              <Segmented
                items={[
                  { value: "included", label: "Included" },
                  { value: "separate", label: "Paid separately" },
                  { value: "none", label: "N/A" },
                ]}
                label={item}
                onChange={(state) => setBill(item, state)}
                value={stateOf(item)}
              />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Appliance fee">
        <Toggle
          checked={form.has_additional_appliance_fee === true}
          label="Extra fee for appliances (rice cooker, electric fan, laptop…)"
          onChange={(event) => setField("has_additional_appliance_fee", event.target.checked)}
        />
        {form.has_additional_appliance_fee && (
          <div className="wizard-grid">
            <Field label="Amount per month">
              <Input inputMode="numeric" leadingIcon={<span>₱</span>} onChange={(event) => setField("appliance_fee_amount", toNumber(event.target.value))} value={form.appliance_fee_amount ?? ""} />
            </Field>
            <Field label="Details" optional>
              <Input onChange={(event) => setField("appliance_fee_label", event.target.value || null)} placeholder="₱100 per appliance" value={form.appliance_fee_label ?? ""} />
            </Field>
          </div>
        )}
      </Section>

      <Section hint="Which networks have good signal inside?" title="Mobile signal">
        <div className="wizard-chips">
          {SIGNAL_OPTIONS.map((signal) => (
            <Chip key={signal} onClick={() => toggleSignal(signal)} selected={signals.includes(signal)}>
              {signal}
            </Chip>
          ))}
        </div>
      </Section>
    </>
  );
}

// ---------------------------------------------------------------------------
// 4. Comfort & amenities
// ---------------------------------------------------------------------------
const AMENITIES: Array<[keyof WizardForm, string]> = [
  ["has_wifi", "Wi‑Fi"],
  ["has_study_area", "Study area"],
  ["has_common_kitchen", "Shared kitchen"],
  ["has_laundry_area", "Laundry area"],
  ["has_drying_area", "Drying area"],
  ["has_parking_area", "Parking"],
  ["has_comfort_room_each_room", "CR in every room"],
  ["has_bathroom_each_floor", "Bathroom on each floor"],
  ["has_charging_slots_each_room", "Charging outlets in rooms"],
  ["has_electric_fans", "Electric fans"],
  ["has_aircon", "Air-conditioning"],
  ["has_refrigerator", "Refrigerator"],
  ["has_television", "Television"],
];

export function ComfortStep({ form, setField }: StepProps) {
  return (
    <>
      <Section hint="Tick everything tenants can use." title="Amenities">
        <div className="wizard-checks">
          {AMENITIES.map(([field, label]) => (
            <Checkbox checked={form[field] === true} key={field} label={label} onChange={(event) => setField(field, event.target.checked as never)} />
          ))}
        </div>
      </Section>
      <Section title="Counts">
        <div className="wizard-grid wizard-grid--3">
          <Field label="Comfort rooms">
            <NumberStepper label="comfort rooms" max={100} min={0} onChange={(value) => setField("comfort_room_count", value)} value={form.comfort_room_count ?? 0} />
          </Field>
          <Field label="Bathrooms">
            <NumberStepper label="bathrooms" max={100} min={0} onChange={(value) => setField("bathroom_count", value)} value={form.bathroom_count ?? 0} />
          </Field>
          {form.has_aircon && (
            <Field label="Rooms with air-con">
              <NumberStepper label="air-conditioned rooms" max={200} min={0} onChange={(value) => setField("aircon_room_count", value)} value={form.aircon_room_count ?? 0} />
            </Field>
          )}
        </div>
      </Section>
      <Section title="Anything else?">
        <Field hint="Separate with commas, e.g. water dispenser, rooftop, CCTV in hallways." label="Other amenities" optional>
          <Input onChange={(event) => setField("other_amenities", event.target.value || null)} value={form.other_amenities ?? ""} />
        </Field>
      </Section>
    </>
  );
}

// ---------------------------------------------------------------------------
// 5. Rules & safety
// ---------------------------------------------------------------------------
const SAFETY: Array<[keyof WizardForm, string]> = [
  ["has_security_cctv", "CCTV"],
  ["has_fire_alarm", "Fire alarm"],
  ["has_smoke_detector", "Smoke detector"],
  ["has_fire_extinguisher", "Fire extinguisher"],
  ["has_sprinkler", "Sprinkler"],
  ["has_emergency_exit", "Emergency exit"],
  ["has_emergency_lights", "Emergency lights"],
];

const NO_CURFEW = "None";

export function RulesStep({ form, setField }: StepProps) {
  const hasCurfew = Boolean(form.curfew && form.curfew !== NO_CURFEW);
  return (
    <>
      <Section hint="Clear rules mean fewer surprises for both sides." title="House rules">
        <div className="wizard-rule">
          <Toggle checked={hasCurfew} label="There’s a curfew" onChange={(event) => setField("curfew", event.target.checked ? "10:00 PM" : NO_CURFEW)} />
          {hasCurfew && (
            <Input aria-label="Curfew time" className="wizard-rule__input" onChange={(event) => setField("curfew", event.target.value || "10:00 PM")} value={form.curfew ?? ""} />
          )}
        </div>
        <div className="wizard-rule">
          <Toggle checked={form.visitors_allowed === true} label="Visitors allowed" onChange={(event) => setField("visitors_allowed", event.target.checked)} />
          {form.visitors_allowed && (
            <Input aria-label="Visiting hours" className="wizard-rule__input" onChange={(event) => setField("visitor_time", event.target.value || null)} placeholder="e.g. until 8 PM" value={form.visitor_time ?? ""} />
          )}
        </div>
        <div className="wizard-rule">
          <Toggle checked={form.pets_allowed === true} label="Pets allowed" onChange={(event) => setField("pets_allowed", event.target.checked)} />
        </div>
        <div className="wizard-rule">
          <Toggle checked={form.smoking_allowed === true} label="Smoking allowed" onChange={(event) => setField("smoking_allowed", event.target.checked)} />
        </div>
      </Section>
      <Section hint="These show as badges on your listing." title="Safety features">
        <div className="wizard-checks">
          {SAFETY.map(([field, label]) => (
            <Checkbox checked={form[field] === true} key={field} label={label} onChange={(event) => setField(field, event.target.checked as never)} />
          ))}
        </div>
      </Section>
    </>
  );
}
