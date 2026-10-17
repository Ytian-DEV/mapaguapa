import { useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, Eye, ImageOff, Info, Send } from "lucide-react";
import { PRICE_BAND_LABELS, priceBandFor, type ListingStatus } from "../../lib/domain";
import { publicPhotoUrl } from "../../lib/photos";
import { Button, ButtonLink, Card, ProgressBar, StatusBadge, Stepper, type StepItem } from "../../ui";
import { listTime } from "../messaging/time";
import { LocationStep } from "./LocationStep";
import { PhotosStep } from "./PhotosStep";
import { ReviewStep } from "./ReviewStep";
import { WIZARD_STEPS, type WizardStepKey } from "./steps";
import { BasicsStep, BillsStep, ComfortStep, RoomsStep, RulesStep, type StepProps } from "./StepsBasic";
import type { SaveState } from "./useWizard";
import type { WizardMode, WizardPhoto } from "./wizardApi";
import type { Check, WizardForm } from "./wizardModel";
import "./wizard.css";

const STEP_INTROS: Record<WizardStepKey, string> = {
  basics: "the name, type and address students search for",
  rooms: "how much it costs and how many people can stay",
  bills: "what the rent includes and what tenants pay for",
  comfort: "the amenities students compare first",
  rules: "house rules and safety features",
  location: "where it is, so students can see the distance to VSU",
  photos: "clear photos get more messages",
  review: "check everything, then send it",
};

export type WizardViewProps = {
  mode: WizardMode;
  step: WizardStepKey;
  stepIndex: number;
  listingId: string | null;
  status: ListingStatus;
  reviewNote: string | null;
  form: WizardForm;
  setField: StepProps["setField"];
  setFields: StepProps["setFields"];
  photos: WizardPhoto[];
  setPhotos: (photos: WizardPhoto[]) => void;
  progress: { percent: number; missingRequired: Check[]; checks: Check[] };
  saveState: SaveState;
  saveError: string | null;
  lastSavedAt: Date | null;
  autosave: boolean;
  isDirty: boolean;
  onGoTo: (step: WizardStepKey) => void;
  onSaveNow: () => void;
  onSubmit: () => Promise<void>;
  ensureListing: () => Promise<string | null>;
  previewHref: string | null;
};

function useTick(ms: number) {
  const [, setNow] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(id);
  }, [ms]);
}

function savedLabel(state: SaveState, lastSavedAt: Date | null, autosave: boolean, isDirty: boolean) {
  if (state === "saving") return "Saving…";
  if (state === "error") return "Not saved";
  if (isDirty && !autosave) return "Unsaved changes";
  if (isDirty) return "Saving soon…";
  if (!lastSavedAt) return "Not saved yet";
  const minutes = Math.round((Date.now() - lastSavedAt.getTime()) / 60_000);
  if (minutes < 1) return "Saved just now";
  if (minutes < 60) return `Saved ${minutes} min ago`;
  return `Saved ${listTime(lastSavedAt.toISOString()).toLowerCase()}`;
}

/** Frame O2: header, stepper with live preview, step form and navigation. */
export function WizardView(props: WizardViewProps) {
  const { mode, step, stepIndex, listingId, status, reviewNote, form, setField, setFields, photos, setPhotos, progress } = props;
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof WizardForm, string>>>({});
  useTick(30_000);

  const isNew = !listingId;
  const isLast = stepIndex === WIZARD_STEPS.length - 1;
  const next = WIZARD_STEPS[stepIndex + 1];
  const prev = WIZARD_STEPS[stepIndex - 1];
  const checksByStep = (key: WizardStepKey) => progress.checks.filter((check) => check.step === key && check.required);

  // A step is ticked when its required items are done; steps without required items once visited.
  const steps: StepItem[] = WIZARD_STEPS.map((item, index) => {
    const required = checksByStep(item.key);
    const complete = required.length > 0 ? required.every((check) => check.done) : index < stepIndex && item.key !== "review";
    return { key: item.key, label: item.label, state: index === stepIndex ? "current" : complete ? "done" : "todo" };
  });

  const goNext = () => {
    if (step === "basics" && !form.name?.trim()) {
      setErrors({ name: "Give your listing a name to continue." });
      return;
    }
    setErrors({});
    if (next) props.onGoTo(next.key);
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      await props.onSubmit();
    } finally {
      setSubmitting(false);
    }
  };

  const stepProps: StepProps = { form, setField, setFields, errors };
  const band = priceBandFor(form.rent_exact !== null ? Number(form.rent_exact) : null);
  const cover = photos[0] ? publicPhotoUrl(photos[0].storage_bucket, photos[0].storage_path) : "";
  const area = form.address?.split(",")[0]?.trim();
  const eyebrow = [isNew ? "New listing" : mode === "admin" ? "Edit listing (admin)" : "Edit listing", savedLabel(props.saveState, props.lastSavedAt, props.autosave, props.isDirty)].join(" · ");
  const canSubmit = progress.missingRequired.length === 0;
  const live = status === "published";
  const submitLabel = mode === "admin" ? (live ? "Save changes" : "Publish listing") : live ? "Save & send for review" : "Submit for review";

  return (
    <div className="wizard">
      <header className="wizard__header">
        <div>
          <p className="v2-eyebrow">{eyebrow}</p>
          <h1 className="v2-h1">{WIZARD_STEPS[stepIndex].label}</h1>
          <p className="wizard__sub">
            Step {stepIndex + 1} of {WIZARD_STEPS.length} — {STEP_INTROS[step]}.
          </p>
        </div>
        <div className="wizard__header-actions">
          {!isNew && <StatusBadge status={status} />}
          <Button disabled={!props.isDirty && !isNew} loading={props.saveState === "saving"} onClick={props.onSaveNow} variant="secondary">
            {props.autosave || isNew ? "Save draft" : "Save changes"}
          </Button>
          {props.previewHref && (
            <ButtonLink leadingIcon={<Eye />} to={props.previewHref} variant="secondary">
              Preview
            </ButtonLink>
          )}
        </div>
      </header>

      {status === "changes_requested" && reviewNote && (
        <div className="wizard-banner wizard-banner--warn" role="status">
          <AlertTriangle aria-hidden="true" />
          <p>
            <strong>Changes requested:</strong> {reviewNote}
          </p>
        </div>
      )}
      {live && mode === "owner" && (
        <div className="wizard-banner" role="status">
          <Info aria-hidden="true" />
          <p>This listing is live. Saving changes sends it back to review, and it’s hidden from search until an admin approves it.</p>
        </div>
      )}
      {props.saveError && (
        <div className="wizard-banner wizard-banner--error" role="alert">
          <AlertTriangle aria-hidden="true" />
          <p>{props.saveError}</p>
        </div>
      )}

      <div className="wizard__layout">
        <aside className="wizard__side">
          <Stepper label="Listing steps" onSelect={(key) => props.onGoTo(key as WizardStepKey)} steps={steps} />
          <Card className="wizard-preview" padding="sm">
            <p className="v2-eyebrow wizard-preview__label">Live preview</p>
            <div className="wizard-preview__photo">{cover ? <img alt="" decoding="async" src={cover} /> : <ImageOff aria-hidden="true" />}</div>
            <p className="wizard-preview__name">{form.name?.trim() || "Untitled listing"}</p>
            <p className="wizard-preview__meta">{[area, form.exclusivity === "Female" ? "Ladies only" : form.exclusivity === "Male" ? "Men only" : form.exclusivity].filter(Boolean).join(" · ") || "Add an address"}</p>
            <p className="wizard-preview__price">{band ? `${PRICE_BAND_LABELS[band]} / mo` : "Set the rent"}</p>
            <ProgressBar label="Listing completeness" value={progress.percent} />
          </Card>
        </aside>

        <Card className="wizard__body">
          <div className="wizard__form">
            {step === "basics" && <BasicsStep {...stepProps} />}
            {step === "rooms" && <RoomsStep {...stepProps} />}
            {step === "bills" && <BillsStep {...stepProps} />}
            {step === "comfort" && <ComfortStep {...stepProps} />}
            {step === "rules" && <RulesStep {...stepProps} />}
            {step === "location" && <LocationStep {...stepProps} />}
            {step === "photos" && (
              <PhotosStep ensureListing={props.ensureListing} listingId={listingId} mode={mode} onPhotosChange={setPhotos} photos={photos} />
            )}
            {step === "review" && <ReviewStep checks={progress.checks} mode={mode} onGoTo={props.onGoTo} status={status} />}
          </div>

          <footer className="wizard__nav">
            {prev ? (
              <Button leadingIcon={<ArrowLeft />} onClick={() => props.onGoTo(prev.key)} variant="secondary">
                Back
              </Button>
            ) : (
              <span />
            )}
            <div className="wizard__nav-right">
              {next && <span className="wizard__next-label">Next: {next.label}</span>}
              {isLast ? (
                <Button disabled={!canSubmit} leadingIcon={<Send />} loading={submitting} onClick={() => void submit()}>
                  {submitLabel}
                </Button>
              ) : (
                <Button onClick={goNext} trailingIcon={<ArrowRight />}>
                  Continue
                </Button>
              )}
            </div>
          </footer>
        </Card>
      </div>
    </div>
  );
}
