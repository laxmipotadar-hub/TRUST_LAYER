import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Banner } from "../../components/ui/Banner";
import { SampleRecorder, type SampleValue } from "./SampleRecorder";
import { copy, getError } from "../../copy";
import { aegisApi } from "../../lib/api";
import { useAnalysis } from "../../context/AnalysisContext";
import type { ApiError, VoiceprintRecord } from "../../types";

export interface EnrollmentFormProps {
  onSuccess: () => void;
  onNavigateList: () => void;
}

export const EnrollmentForm: React.FC<EnrollmentFormProps> = ({
  onSuccess,
  onNavigateList,
}) => {
  const [searchParams] = useSearchParams();
  const { executionMode, refreshVoiceprints, refreshSystem } = useAnalysis();
  const [customerId, setCustomerId] = useState(() => searchParams.get("customer_id") || "");
  const [customerName, setCustomerName] = useState(() => searchParams.get("customer_name") || "");
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
    const cleanId = customerId.trim().toUpperCase();
    if (!/^[A-Za-z0-9_.:-]{1,64}$/.test(cleanId)) {
      setErrorMsg("Customer ID must match ^[A-Za-z0-9_.:-]{1,64}$ (letters, numbers, -, _, ., :).");
      return;
    }

    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      const record = await aegisApi.enrollVoiceprintAudio({
        file: primarySample.blob,
        customer_id: cleanId,
        customer_name: customerName.trim(),
        account_tier: accountTier,
        consent_confirmed: true,
        sample_duration_sec: primarySample.duration,
        execution_mode: executionMode,
      });
      await Promise.all([refreshVoiceprints(), refreshSystem()]);
      setEnrolledRecord(record);
      onSuccess();
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      setErrorMsg(apiErr?.message || getError(apiErr?.code || "CLIENT_ERROR", apiErr?.message));
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
        <div className="p-3 rounded-lg bg-[var(--fill-subtle)] border border-[var(--border)] text-[14px] space-y-1 text-left">
          <p>
            <strong>customer_id:</strong> <span className="font-mono">{enrolledRecord.customer_id}</span>
          </p>
          <p>
            <strong>speaker_id:</strong>{" "}
            <span className="font-mono">
              {enrolledRecord.provider_speaker_id || enrolledRecord.provider_speaker_ref || "N/A"}
            </span>
          </p>
          <p>
            <strong>operation_id:</strong>{" "}
            <span className="font-mono">{enrolledRecord.provider_operation_id || (enrolledRecord.reconciled ? "Reconciled existing provider speaker" : "SIMULATION")}</span>
          </p>
          <p>
            <strong>credits_used:</strong>{" "}
            <span className="font-mono">{enrolledRecord.credits_used ?? 0} credits</span>
          </p>
        </div>
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

      {executionMode === "DEMO" && (
        <Banner variant="warn" title="DEMO Mode Active (Simulation Enrollment)">
          Enrollments in DEMO mode create simulation-only records (`sim-*`) and cannot be verified by live DetectifAI Eidos in Analyze. Switch the header toggle to LIVE to enroll a real provider speaker ID.
        </Banner>
      )}

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
