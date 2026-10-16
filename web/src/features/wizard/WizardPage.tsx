import { useEffect } from "react";
import { SearchX } from "lucide-react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import type { ListingStatus } from "../../lib/domain";
import { ButtonLink, EmptyState, Skeleton, useToast } from "../../ui";
import { WIZARD_STEPS, type WizardStepKey } from "./steps";
import { useWizard } from "./useWizard";
import type { WizardMode } from "./wizardApi";
import { WizardView } from "./WizardView";

/**
 * /owner/listings/:listingId/edit/:step (listingId "new" for a new listing).
 * Admins reuse it under /admin with mode="admin".
 */
export default function WizardPage({ mode = "owner", onDone }: { mode?: WizardMode; onDone?: () => void }) {
  const params = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const listingId = params.listingId && params.listingId !== "new" ? params.listingId : null;
  const step = (WIZARD_STEPS.find((item) => item.key === params.step)?.key ?? "basics") as WizardStepKey;
  const wizard = useWizard({ listingId, step, mode });

  useEffect(() => {
    document.title = `${listingId ? "Edit listing" : "New listing"} · mapaguapa`;
  }, [listingId]);

  if (params.step && !WIZARD_STEPS.some((item) => item.key === params.step)) {
    return <Navigate replace to={`${wizard.base}/listings/${params.listingId ?? "new"}/edit/basics`} />;
  }

  if (wizard.loadState === "loading") return <Skeleton height={520} radius="var(--radius-card-lg)" />;
  if (wizard.loadState === "missing" || wizard.loadState === "error") {
    return (
      <EmptyState
        action={<ButtonLink to={`${wizard.base}/listings`}>Back to listings</ButtonLink>}
        description={wizard.loadState === "missing" ? "It may have been archived or belongs to someone else." : "Check your connection and try again."}
        icon={<SearchX />}
        title={wizard.loadState === "missing" ? "Listing not found" : "Couldn’t load this listing"}
        tone={wizard.loadState === "error" ? "error" : "neutral"}
      />
    );
  }

  const status = (wizard.listing?.status ?? "draft") as ListingStatus;
  if (status === "archived" && mode === "owner") {
    return (
      <EmptyState
        action={<ButtonLink to="/owner/listings">Back to my listings</ButtonLink>}
        description="Archived listings can only be restored by an admin."
        icon={<SearchX />}
        title="This listing is archived"
      />
    );
  }

  const handleSubmit = async () => {
    try {
      const ok = await wizard.submit();
      if (!ok) return;
      toast.success(mode === "admin" ? "Listing published." : "Sent for review. We’ll let you know when it’s live.");
      if (onDone) onDone();
      else navigate(`${wizard.base}/listings`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn’t submit. Try again.");
    }
  };

  const previewBase = mode === "admin" ? "/admin/listings" : "/owner/listings";

  return (
    <WizardView
      autosave={wizard.autosave}
      ensureListing={async () => {
        const result = await wizard.flush();
        return result ? result.id : wizard.listing?.id ?? null;
      }}
      form={wizard.form}
      isDirty={wizard.isDirty}
      lastSavedAt={wizard.lastSavedAt}
      listingId={wizard.listing?.id ?? null}
      mode={mode}
      onGoTo={(target) => void wizard.goTo(target)}
      onSaveNow={() => void wizard.flush()}
      onSubmit={handleSubmit}
      photos={wizard.photos}
      previewHref={wizard.listing && previewBase ? `${previewBase}/${wizard.listing.id}/preview` : null}
      progress={wizard.progress}
      reviewNote={wizard.listing?.review_note ?? null}
      saveError={wizard.saveError}
      saveState={wizard.saveState}
      setField={wizard.setField}
      setFields={wizard.setFields}
      setPhotos={wizard.setPhotos}
      status={status}
      step={step}
      stepIndex={wizard.stepIndex}
    />
  );
}
