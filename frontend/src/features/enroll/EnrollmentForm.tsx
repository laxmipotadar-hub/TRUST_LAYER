import React, { useState } from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Banner } from "../../components/ui/Banner";
import { SampleRecorder, type SampleValue } from "./SampleRecorder";
import { copy, getError } from "../../copy";
import { aegisApi } from "../../lib/api";
import type { ApiError, VoiceprintRecord } from "../../types";

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
  const [accountTier, setAccountTier] = useState("Private Banking");
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [primarySample, setPrimarySample] = useState<SampleValue | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [enrolledRecord, setEnrolledRecord] = useState<VoiceprintRecord | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consentConfirmed) {
      setErrorMsg(copy.enroll.consentRequiredError);
      return;
    }
    if (!primarySample) {
      setErrorMsg("Please record or upload a 20–30 s voice sample first.");
      return;
    }
    if (!customerId.trim() || !customerName.trim()) {
      setErrorMsg(getError("INVALID_PAYLOAD"));
      return;
    }

    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      const record = await aegisApi.enrollVoiceprintAudio({
        file: primarySample.blob,
        customer_id: customerId.trim().toUpperCase(),
        customer_name: customerName.trim(),
        account_tier: accountTier,
        consent_confirmed: true,
        sample_duration_sec: primarySample.duration,
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
          {enrolledRecord.voiceprint_id}: {copy.enroll.successSuffix}
        </h3>
        <p className="body-text">
          customer_id: <span className="font-mono font-semibold">{enrolledRecord.customer_id}</span> ·{" "}
          provider_speaker_ref: <span className="font-mono">{enrolledRecord.provider_speaker_ref}</span>
        </p>
        <div className="pt-2 flex justify-center gap-3">
          <Button
            variant="secondary"
            onClick={() => {
              setEnrolledRecord(null);
              setCustomerId("");
              setCustomerName("");
              setPrimarySample(null);
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-[14px] font-semibold text-[var(--text-primary)] mb-1">
              {copy.enroll.customerIdLabel}
            </label>
            <input
              type="text"
              required
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              placeholder="CUST-5510-USER"
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
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Full Name"
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-[14px] bg-[var(--surface)]"
            />
          </div>
          <div>
            <label className="block text-[14px] font-semibold text-[var(--text-primary)] mb-1">
              Account Tier
            </label>
            <input
              type="text"
              value={accountTier}
              onChange={(e) => setAccountTier(e.target.value)}
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

        <label className="flex items-start gap-3 p-3.5 rounded-lg border border-[var(--border)] bg-[var(--fill-subtle)] cursor-pointer text-[14px]">
          <input
            type="checkbox"
            checked={consentConfirmed}
            onChange={(e) => setConsentConfirmed(e.target.checked)}
            className="w-4 h-4 mt-0.5 accent-[var(--brand-navy)]"
          />
          <span className="text-[var(--text-primary)]">{copy.enroll.consentCheckbox}</span>
        </label>

        <div className="flex justify-end">
          <Button type="submit" variant="primary" loading={isSubmitting}>
            {copy.enroll.submitButton}
          </Button>
        </div>
      </form>
    </Card>
  );
};
