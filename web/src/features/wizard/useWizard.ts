import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createDraft, fetchForEdit, saveListing, submitListing, type WizardMode, type WizardPhoto } from "./wizardApi";
import { WIZARD_STEPS, editPath, type WizardStepKey } from "./steps";
import { EMPTY_FORM, completeness, diffForm, formFromListing, type WizardForm, type WizardListing } from "./wizardModel";
import { reportError } from "../../lib/errors";

const AUTOSAVE_DELAY_MS = 1500;

export type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

type UseWizardArgs = { listingId: string | null; step: WizardStepKey; mode: WizardMode };

/** flush() result: the saved listing, null when there was nothing to save yet, false on error. */
export type FlushResult = WizardListing | null | false;

/**
 * Wizard state: the form, autosave and navigation between steps.
 * Drafts (and listings with changes requested) autosave; edits to live
 * listings are saved explicitly because saving sends them back to review.
 */
export function useWizard({ listingId, step, mode }: UseWizardArgs) {
  const navigate = useNavigate();
  const base = mode === "admin" ? "/admin" : "/owner";
  const [listing, setListing] = useState<WizardListing | null>(null);
  const [saved, setSaved] = useState<WizardForm>(EMPTY_FORM);
  const [form, setForm] = useState<WizardForm>(EMPTY_FORM);
  const [photos, setPhotos] = useState<WizardPhoto[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "missing" | "error">(listingId ? "loading" : "ready");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const inFlight = useRef<Promise<FlushResult> | null>(null);
  const formRef = useRef(form);
  formRef.current = form;
  const savedRef = useRef(saved);
  savedRef.current = saved;
  const listingRef = useRef(listing);
  listingRef.current = listing;

  const stepIndex = Math.max(0, WIZARD_STEPS.findIndex((item) => item.key === step));
  const stepNumber = stepIndex + 1;
  const status = listing?.status ?? "draft";
  const autosave = status === "draft" || (status === "changes_requested" && mode === "owner");

  useEffect(() => {
    if (!listingId) {
      setLoadState("ready");
      return;
    }
    if (listingRef.current?.id === listingId) return;
    let cancelled = false;
    setLoadState("loading");
    fetchForEdit(listingId)
      .then((result) => {
        if (cancelled) return;
        if (!result) {
          setLoadState("missing");
          return;
        }
        const next = formFromListing(result.listing);
        setListing(result.listing);
        setSaved(next);
        setForm(next);
        setPhotos(result.photos);
        setLastSavedAt(new Date(result.listing.updated_at));
        setLoadState("ready");
      })
      .catch((error) => {
        reportError(error);
        if (!cancelled) setLoadState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [listingId]);

  const isDirty = useMemo(() => Object.keys(diffForm(saved, form)).length > 0, [saved, form]);

  /** Saves pending changes (creating the draft on first save). Resolves to the saved listing. */
  const flush = useCallback(async (): Promise<FlushResult> => {
    window.clearTimeout(timer.current);
    if (inFlight.current) await inFlight.current;
    const current = formRef.current;
    const existing = listingRef.current;
    const patch = diffForm(savedRef.current, current);
    const draftStep = existing?.status === "draft" || !existing ? Math.max(stepNumber, existing?.draft_step ?? 1) : undefined;
    const stepChanged = draftStep !== undefined && existing?.draft_step !== draftStep;
    if (existing && Object.keys(patch).length === 0 && !stepChanged) return existing;
    if (!existing && Object.keys(patch).length === 0) return null;

    setSaveState("saving");
    setSaveError(null);
    const run = (async () => {
      try {
        const result = existing
          ? await saveListing(existing.id, { ...patch, ...(stepChanged ? { draft_step: draftStep } : {}) })
          : await createDraft(current, stepNumber);
        setListing(result);
        setSaved(current);
        setLastSavedAt(new Date());
        setSaveState("saved");
        if (!existing) navigate(editPath(base, result.id, step), { replace: true });
        return result;
      } catch (error) {
        reportError(error);
        setSaveState("error");
        setSaveError(error instanceof Error ? error.message : "Couldn’t save. Check your connection.");
        return false;
      } finally {
        inFlight.current = null;
      }
    })();
    inFlight.current = run;
    return run;
  }, [base, navigate, step, stepNumber]);

  const setField = useCallback(<K extends keyof WizardForm>(field: K, value: WizardForm[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
  }, []);

  const setFields = useCallback((patch: Partial<WizardForm>) => {
    setForm((current) => ({ ...current, ...patch }));
  }, []);

  // Autosave drafts a moment after the last change.
  useEffect(() => {
    if (!isDirty) return undefined;
    setSaveState((current) => (current === "saving" ? current : "dirty"));
    if (!autosave) return undefined;
    // A brand-new listing is only created once it has a name.
    if (!listingRef.current && !form.name?.trim()) return undefined;
    timer.current = window.setTimeout(() => void flush(), AUTOSAVE_DELAY_MS);
    return () => window.clearTimeout(timer.current);
  }, [autosave, flush, form, isDirty]);

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!isDirty) return undefined;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const goTo = useCallback(
    async (target: WizardStepKey) => {
      // Live listings keep unsaved edits in memory while moving between steps.
      if (autosave || !listingRef.current) {
        const result = await flush();
        if (result === false) return;
      }
      navigate(editPath(base, listingRef.current?.id ?? "new", target));
    },
    [autosave, base, flush, navigate]
  );

  const submit = useCallback(async () => {
    const result = await flush();
    if (result === false) return false;
    const id = result?.id ?? listingRef.current?.id;
    if (!id) return false;
    const updated = await submitListing(id, mode);
    setListing(updated);
    return true;
  }, [flush, mode]);

  const progress = useMemo(() => completeness(form, photos.length), [form, photos.length]);

  return {
    listing,
    form,
    setField,
    setFields,
    photos,
    setPhotos,
    loadState,
    saveState,
    saveError,
    lastSavedAt,
    isDirty,
    autosave,
    flush,
    goTo,
    submit,
    progress,
    stepIndex,
    base,
  };
}

export type WizardController = ReturnType<typeof useWizard>;
