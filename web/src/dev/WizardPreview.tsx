import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppShell, Sidebar, useToast } from "../ui";
import { WIZARD_STEPS, type WizardStepKey } from "../features/wizard/steps";
import type { SaveState } from "../features/wizard/useWizard";
import type { WizardPhoto } from "../features/wizard/wizardApi";
import { EMPTY_FORM, completeness, type WizardForm } from "../features/wizard/wizardModel";
import { WizardView } from "../features/wizard/WizardView";

// Dev-only: the real wizard UI with local state (nothing is saved).
export default function WizardPreview() {
  const { step: stepParam } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const step = (WIZARD_STEPS.find((item) => item.key === stepParam)?.key ?? "basics") as WizardStepKey;
  const stepIndex = WIZARD_STEPS.findIndex((item) => item.key === step);
  const [form, setForm] = useState<WizardForm>({ ...EMPTY_FORM, name: "Fixture Annex", address: "Guadalupe, Baybay City, Leyte", rent_exact: 2800, exclusivity: "Mixed" });
  const [photos, setPhotos] = useState<WizardPhoto[]>([]);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(new Date(Date.now() - 2 * 60_000));
  const progress = useMemo(() => completeness(form, photos.length), [form, photos.length]);

  return (
    <AppShell sidebar={<Sidebar groups={[]} homeTo="/dev/wizard" onSignOut={() => undefined} user={{ name: "Fixture Owner", subtitle: "Owner", tone: "clay" }} workspace="Owner portal" />}>
      <WizardView
        autosave
        ensureListing={async () => "fixture"}
        form={form}
        isDirty={saveState === "dirty"}
        lastSavedAt={lastSavedAt}
        listingId="fixture"
        mode="owner"
        onGoTo={(target) => navigate(`/dev/wizard/${target}`)}
        onSaveNow={() => {
          setSaveState("saved");
          setLastSavedAt(new Date());
        }}
        onSubmit={async () => toast.success("Would submit for review")}
        photos={photos}
        previewHref={null}
        progress={progress}
        reviewNote={null}
        saveError={null}
        saveState={saveState}
        setField={(field, value) => {
          setForm((current) => ({ ...current, [field]: value }));
          setSaveState("dirty");
        }}
        setFields={(patch) => {
          setForm((current) => ({ ...current, ...patch }));
          setSaveState("dirty");
        }}
        setPhotos={setPhotos}
        status="draft"
        step={step}
        stepIndex={stepIndex}
      />
    </AppShell>
  );
}
