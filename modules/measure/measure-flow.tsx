"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Link } from "@/i18n/routing";
import { Measure, parseMeasureInput } from "@/modules/ui";

import {
  completeMeasureFlow,
  saveMeasurementField,
  setMeasureFlowStep,
} from "./actions";
import { flowValueKey } from "./build-flow-steps";
import type { MeasureFlowSessionState } from "./queries";

type Props = {
  initialState: MeasureFlowSessionState;
  isSignedIn: boolean;
};

function displayInches(hundredths: number): string {
  return (hundredths / 100).toFixed(2).replace(/\.?0+$/, "");
}

export function MeasureFlow({ initialState, isSignedIn }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState(initialState.values);
  const [stepIndex, setStepIndex] = useState(() => {
    if (initialState.completedAt) return initialState.steps.length;
    const resume = Math.min(
      initialState.currentStepIndex,
      initialState.steps.length,
    );
    const firstIncomplete = initialState.steps.findIndex((step) => {
      const key = flowValueKey(step.componentKey, step.measurementKey);
      return values[key] === undefined;
    });
    if (firstIncomplete === -1) return initialState.steps.length;
    return Math.min(resume, firstIncomplete);
  });
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [acknowledged, setAcknowledged] = useState(
    Boolean(initialState.acknowledgedAt),
  );
  const [saveProfile, setSaveProfile] = useState(false);
  const [profileLabel, setProfileLabel] = useState("My measurements");

  const steps = initialState.steps;
  const onReview = stepIndex >= steps.length;
  const currentStep = onReview ? null : steps[stepIndex];

  const currentValue = useMemo(() => {
    if (!currentStep) return undefined;
    return values[flowValueKey(currentStep.componentKey, currentStep.measurementKey)];
  }, [currentStep, values]);

  useEffect(() => {
    if (currentValue !== undefined) {
      setInput(displayInches(currentValue));
    } else {
      setInput("");
    }
  }, [stepIndex, currentValue]);

  const persist = useCallback(
    (confirmWarnings = false) => {
      if (!currentStep) return;
      const parsed = parseMeasureInput(input, "in");
      if (parsed === null) {
        setError("Enter a measurement in inches — for example, 36 or 36.5.");
        return;
      }

      setError(null);
      startTransition(async () => {
        const result = await saveMeasurementField({
          designSlug: initialState.designSlug,
          stepIndex,
          rawValue: parsed,
          confirmWarnings,
        });

        if (!result.ok) {
          if (result.warnings?.length && !confirmWarnings) {
            setWarnings(result.warnings);
            setError(result.error);
            return;
          }
          setError(result.error);
          setWarnings([]);
          return;
        }

        const key = flowValueKey(
          currentStep.componentKey,
          currentStep.measurementKey,
        );
        setValues((prev) => ({ ...prev, [key]: result.snappedValue }));
        setWarnings([]);
        setError(null);
        setStepIndex((i) => Math.min(i + 1, steps.length));
        router.refresh();
      });
    },
    [currentStep, input, initialState.designSlug, router, stepIndex, steps.length],
  );

  function goBack() {
    if (stepIndex <= 0) return;
    const next = stepIndex - 1;
    setStepIndex(next);
    startTransition(async () => {
      await setMeasureFlowStep({
        designSlug: initialState.designSlug,
        stepIndex: next,
      });
    });
  }

  function finish() {
    startTransition(async () => {
      const result = await completeMeasureFlow({
        designSlug: initialState.designSlug,
        acknowledged,
        saveToProfile: saveProfile && isSignedIn,
        profileLabel,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/designs/${initialState.designSlug}?sizeMode=MADE_TO_MEASURE`);
      router.refresh();
    });
  }

  if (initialState.completedAt) {
    return (
      <CompletedBanner
        designSlug={initialState.designSlug}
        designName={initialState.designName}
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="mb-3 text-[12px] uppercase tracking-[0.1em] text-madder">
          Made to measure
        </p>
        <h1 className="mb-3 font-display text-[32px] font-medium leading-tight text-ink">
          {initialState.designName}
        </h1>
        {!onReview ? (
          <p className="text-[15px] leading-relaxed text-ink/75">
            Tell us your measurements and watch the fit change. Take your time —
            this is the part that makes it yours.
          </p>
        ) : null}
      </header>

      {!onReview && currentStep ? (
        <>
          <div className="flex items-baseline justify-between gap-4 border-b border-greige-deep pb-3">
            <p className="font-data text-[11px] uppercase tracking-[0.12em] text-ink/50">
              Step {stepIndex + 1} of {steps.length}
            </p>
            {steps.length > 1 ? (
              <p className="text-[12px] text-ink/60">{currentStep.componentKey}</p>
            ) : null}
          </div>

          <section>
            <h2 className="mb-2 font-display text-[22px] text-ink">
              {currentStep.label}
            </h2>
            <p className="mb-6 text-[14px] leading-relaxed text-ink/75">
              {currentStep.helpText}
            </p>

            <div
              className="mb-6 aspect-video border border-greige-deep bg-greige-deep/20"
              aria-hidden={!currentStep.demoVideoAssetId}
            >
              {currentStep.demoVideoAssetId ? (
                <p className="flex h-full items-center justify-center text-[12px] uppercase tracking-[0.08em] text-ink/40">
                  Demo video
                </p>
              ) : (
                <p className="flex h-full items-center justify-center text-[12px] text-ink/40">
                  Video guide coming soon
                </p>
              )}
            </div>

            <label className="mb-2 block text-[12px] uppercase tracking-[0.08em] text-ink/60">
              Your measurement (inches)
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onBlur={() => {
                if (input.trim()) persist(false);
              }}
              className="w-full max-w-[200px] border border-greige-deep bg-transparent px-3 py-2.5 font-data text-[18px] text-ink"
              aria-invalid={Boolean(error)}
            />
            {currentValue !== undefined ? (
              <p className="mt-2 text-[12px] text-ink/50">
                Saved as <Measure value={currentValue} />
              </p>
            ) : null}

            {error ? (
              <p className="mt-3 text-[14px] text-madder" role="alert">
                {error}
              </p>
            ) : null}

            {warnings.length > 0 ? (
              <div className="mt-4 border border-zari/40 bg-greige px-4 py-3">
                {warnings.map((w) => (
                  <p key={w} className="text-[14px] leading-relaxed text-ink">
                    {w}
                  </p>
                ))}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => persist(true)}
                    className="border border-ink bg-ink px-4 py-2 text-[12px] uppercase tracking-[0.08em] text-greige"
                  >
                    Looks right — continue
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      setWarnings([]);
                      setError(null);
                    }}
                    className="border border-greige-deep px-4 py-2 text-[12px] uppercase tracking-[0.08em] text-ink"
                  >
                    Let me check
                  </button>
                </div>
              </div>
            ) : null}
          </section>

          <div className="flex flex-wrap gap-3">
            {stepIndex > 0 ? (
              <button
                type="button"
                disabled={pending}
                onClick={goBack}
                className="border border-greige-deep px-4 py-2.5 text-[12px] uppercase tracking-[0.08em] text-ink"
              >
                Back
              </button>
            ) : null}
            <button
              type="button"
              disabled={pending}
              onClick={() => persist(false)}
              className="border border-ink bg-ink px-5 py-2.5 text-[12px] uppercase tracking-[0.08em] text-greige"
            >
              Save &amp; continue
            </button>
          </div>
        </>
      ) : (
        <ReviewScreen
          steps={steps}
          values={values}
          acknowledged={acknowledged}
          onAcknowledgedChange={setAcknowledged}
          saveProfile={saveProfile}
          onSaveProfileChange={setSaveProfile}
          profileLabel={profileLabel}
          onProfileLabelChange={setProfileLabel}
          isSignedIn={isSignedIn}
          error={error}
          pending={pending}
          onBack={() => setStepIndex(steps.length - 1)}
          onFinish={finish}
        />
      )}
    </div>
  );
}

function ReviewScreen({
  steps,
  values,
  acknowledged,
  onAcknowledgedChange,
  saveProfile,
  onSaveProfileChange,
  profileLabel,
  onProfileLabelChange,
  isSignedIn,
  error,
  pending,
  onBack,
  onFinish,
}: {
  steps: MeasureFlowSessionState["steps"];
  values: Record<string, number>;
  acknowledged: boolean;
  onAcknowledgedChange: (v: boolean) => void;
  saveProfile: boolean;
  onSaveProfileChange: (v: boolean) => void;
  profileLabel: string;
  onProfileLabelChange: (v: string) => void;
  isSignedIn: boolean;
  error: string | null;
  pending: boolean;
  onBack: () => void;
  onFinish: () => void;
}) {
  return (
    <section className="flex flex-col gap-6">
      <div>
        <h2 className="mb-2 font-display text-[24px] text-ink">
          Review your measurements
        </h2>
        <p className="text-[14px] leading-relaxed text-ink/75">
          Here is what we will cut to. We work to ±0.5″ tolerance — if something
          looks off, now is the time to fix it.
        </p>
      </div>

      <dl className="divide-y divide-greige-deep border border-greige-deep">
        {steps.map((step) => {
          const key = flowValueKey(step.componentKey, step.measurementKey);
          const value = values[key];
          return (
            <div
              key={key}
              className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3"
            >
              <dt className="text-[14px] text-ink">
                {step.label}
                {steps.some(
                  (s) =>
                    s.measurementKey === step.measurementKey &&
                    s.componentKey !== step.componentKey,
                ) ? (
                  <span className="ms-2 text-[11px] uppercase tracking-[0.08em] text-ink/45">
                    {step.componentKey}
                  </span>
                ) : null}
              </dt>
              <dd className="font-data text-[15px] text-ink">
                {value !== undefined ? <Measure value={value} /> : "—"}
              </dd>
            </div>
          );
        })}
      </dl>

      <div className="border border-greige-deep px-4 py-4">
        <label className="flex gap-3 text-[14px] leading-relaxed text-ink">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => onAcknowledgedChange(e.target.checked)}
            className="mt-1 size-4 shrink-0 border border-greige-deep"
          />
          <span>
            I understand this garment will be made to my measurements and cannot
            be returned once fabric is cut to my specification.
          </span>
        </label>
      </div>

      {isSignedIn ? (
        <div className="border border-greige-deep px-4 py-4">
          <label className="flex gap-3 text-[14px] text-ink">
            <input
              type="checkbox"
              checked={saveProfile}
              onChange={(e) => onSaveProfileChange(e.target.checked)}
              className="mt-1 size-4 shrink-0 border border-greige-deep"
            />
            <span>Save these measurements to my account for next time</span>
          </label>
          {saveProfile ? (
            <input
              type="text"
              value={profileLabel}
              onChange={(e) => onProfileLabelChange(e.target.value)}
              className="mt-3 w-full max-w-sm border border-greige-deep bg-transparent px-3 py-2 text-[14px] text-ink"
              placeholder="Profile name"
            />
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p className="text-[14px] text-madder" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={onBack}
          className="border border-greige-deep px-4 py-2.5 text-[12px] uppercase tracking-[0.08em] text-ink"
        >
          Back
        </button>
        <button
          type="button"
          disabled={pending || !acknowledged}
          onClick={onFinish}
          className="border border-ink bg-ink px-5 py-2.5 text-[12px] uppercase tracking-[0.08em] text-greige disabled:opacity-40"
        >
          Use these measurements
        </button>
      </div>
    </section>
  );
}

function CompletedBanner({
  designSlug,
  designName,
}: {
  designSlug: string;
  designName: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[12px] uppercase tracking-[0.1em] text-madder">
        Made to measure
      </p>
      <h1 className="font-display text-[32px] font-medium text-ink">{designName}</h1>
      <p className="text-[15px] leading-relaxed text-ink/75">
        Your measurements are saved for this design. You can adjust them any time
        before you order.
      </p>
      <Link
        href={`/designs/${designSlug}?sizeMode=MADE_TO_MEASURE`}
        className="inline-block w-fit border border-ink bg-ink px-5 py-2.5 text-[12px] uppercase tracking-[0.08em] text-greige"
      >
        Back to design
      </Link>
    </div>
  );
}
