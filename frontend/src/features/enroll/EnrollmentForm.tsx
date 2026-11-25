import React, { useState } from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Banner } from "../../components/ui/Banner";
import { Tooltip } from "../../components/ui/Tooltip";
import { SampleRecorder, type SampleValue } from "./SampleRecorder";
import { copy, getError } from "../../copy";
import { aegisApi } from "../../lib/api";
import type { ApiError, Voiceprint } from "../../types";

export interface EnrollmentFormProps {
  onSuccess: () => void;
  onNavigateList: () => void;
}

export const EnrollmentForm: React.FC<EnrollmentFormProps> = ({
  onSuccess,
  onNavigateList,
}) => {
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [primarySample, setPrimarySample] = useState<SampleValue | null>(null);
  const [secondSample, setSecondSample] = useState<SampleValue | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [enrolledRecord, setEnrolledRecord] = useState<Voiceprint | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consentConfirmed) {
      setErrorMsg(copy.enroll.consentRequiredError);
      return;
    }
    if (!primarySample) {
      setErrorMsg(copy.enroll.durationRuleError);
      return;
    }
    if (!customerId.trim() || !customerName.trim()) {
      setErrorMsg(getError("INVALID_PAYLOAD"));
      return;
    }

    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      const record = await aegisApi.enrollVoiceprint({
        audio: primarySample.blob,
        secondAudio: secondSample?.blob,
        claimed_user_id: customerId.trim().toUpperCase(),
        user_name: customerName.trim(),
        consent: true,
        durationSeconds: primarySample.duration,
      });
      setEnrolledRecord(record);
      onSuccess();
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      setErrorMsg(getError(apiErr?.code || "CLIENT_ERROR", apiErr?.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (enrolledRecord) {
    return (
      <Card className="text-center py-8 space-y-4 max-w-lg mx-auto">
        <div className="w-12 h-12 bg-[var(--decision-continue-tint)] text-[var(--decision-continue-solid)] rounded-full flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-7 h-7" />
        </div>
        <h3 className="section-title text-[var(--decision-continue-text)]">
          {enrolledRecord.id}: {copy.enroll.successSuffix}
        </h3>
        <p className="body-text">{copy.enroll.successDesc}</p>
        <div className="pt-2 flex justify-center gap-3">
          <Button
            variant="secondary"
            onClick={() => {
              setEnrolledRecord(null);
              setCustomerId("");
              setCustomerName("");
              setPrimarySample(null);
              setSecondSample(null);
              setConsentConfirmed(false);
            }}
          >
            {copy.enroll.enrollAnother}
          </Button>
          <Button variant="primary" onClick={onNavigateList}>
            {copy.enroll.viewVoiceprints}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="max-w-2xl mx-auto space-y-5">
      <div>
        <h2 className="section-title">{copy.enroll.pageTitle}</h2>
        <p className="caption-text">{copy.enroll.pageSubtitle}</p>
      </div>

      <Banner variant="info">{copy.enroll.retentionBanner}</Banner>

      {errorMsg && (
        <div className="p-3 bg-[var(--decision-endcall-tint)] border border-[var(--decision-endcall-border)] rounded-lg text-[14px] text-[var(--decision-endcall-text)] flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[14px] font-semibold text-[var(--text-primary)] mb-1">
              {copy.enroll.customerIdLabel}
            </label>
            <input
              type="text"
              required
              placeholder={copy.enroll.customerIdPlaceholder}
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-[14px] bg-[var(--surface)]"
            />
          </div>

          <div>
            <label className="block text-[14px] font-semibold text-[var(--text-primary)] mb-1">
              {copy.enroll.customerNameLabel}
            </label>
            <input
              type="text"
              required
              placeholder={copy.enroll.customerNamePlaceholder}
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-[14px] bg-[var(--surface)]"
            />
          </div>
        </div>

        <SampleRecorder
          label={copy.enroll.audioSourceLabel}
          sample={primarySample}
          onChange={setPrimarySample}
          requiredDuration={true}
        />

        <SampleRecorder
          label={copy.enroll.secondSampleLabel}
          sample={secondSample}
          onChange={setSecondSample}
          requiredDuration={false}
        />

        <div className="p-3.5 bg-[var(--fill-subtle)] rounded-lg border border-[var(--border)] flex items-start gap-3">
          <input
            type="checkbox"
            id="biometric-consent"
            checked={consentConfirmed}
            onChange={(e) => setConsentConfirmed(e.target.checked)}
            className="mt-1 w-4 h-4 rounded border-[var(--border)] text-[var(--brand-navy)] cursor-pointer"
          />
          <label htmlFor="biometric-consent" className="text-[14px] text-[var(--text-primary)] cursor-pointer">
            {copy.enroll.consentCheckbox}
          </label>
          <Tooltip content={copy.tooltips.voiceprintConsent} />
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full"
          loading={isSubmitting}
          disabled={isSubmitting || !consentConfirmed || !primarySample}
        >
          {isSubmitting ? copy.enroll.enrollingButton : copy.enroll.submitButton}
        </Button>
      </form>
    </Card>
  );
};
