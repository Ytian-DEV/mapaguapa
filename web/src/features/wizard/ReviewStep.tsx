import { Check, Circle, CircleAlert } from "lucide-react";
import type { Check as CompletenessCheck } from "./wizardModel";
import { WIZARD_STEPS, type WizardStepKey } from "./steps";

type ReviewStepProps = {
  checks: CompletenessCheck[];
  onGoTo: (step: WizardStepKey) => void;
  mode: "owner" | "admin";
  status: string;
};

/** Step 8: what's done, what's missing (with links), and what happens next. */
export function ReviewStep({ checks, onGoTo, mode, status }: ReviewStepProps) {
  const required = checks.filter((check) => check.required);
  const recommended = checks.filter((check) => !check.required);
  const label = (step: WizardStepKey) => WIZARD_STEPS.find((item) => item.key === step)?.label ?? step;

  const List = ({ items }: { items: CompletenessCheck[] }) => (
    <ul className="review-list">
      {items.map((check) => (
        <li className={check.done ? "is-done" : check.required ? "is-missing" : undefined} key={check.key}>
          <span aria-hidden="true" className="review-list__icon">
            {check.done ? <Check /> : check.required ? <CircleAlert /> : <Circle />}
          </span>
          <span className="review-list__label">
            {check.label}
            <span className="v2-sr-only">{check.done ? " (done)" : " (missing)"}</span>
          </span>
          {!check.done && (
            <button className="review-list__fix" onClick={() => onGoTo(check.step)} type="button">
              Add in {label(check.step)}
            </button>
          )}
        </li>
      ))}
    </ul>
  );

  return (
    <>
      <section className="wizard-section">
        <div className="wizard-section__head">
          <h2>Required</h2>
          <p>{required.every((check) => check.done) ? "Everything students need is filled in." : "Finish these before submitting."}</p>
        </div>
        <List items={required} />
      </section>
      <section className="wizard-section">
        <div className="wizard-section__head">
          <h2>Recommended</h2>
          <p>Listings with these get more messages.</p>
        </div>
        <List items={recommended} />
      </section>
      <section className="wizard-section">
        <div className="wizard-section__head">
          <h2>What happens next</h2>
        </div>
        <p className="wizard-next">
          {mode === "admin"
            ? "Publishing makes the listing visible to students right away."
            : status === "published"
              ? "Your changes go to an admin for review. Until they’re approved, the listing is hidden from search."
              : "An admin checks the details, photos and map pin — usually within a day. You’ll see the status in My listings, and any requested changes will appear here."}
        </p>
      </section>
    </>
  );
}
