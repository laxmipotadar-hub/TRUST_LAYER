import React, { useEffect, useState } from "react";
import { KeyRound, Shield, Database, Trash2, Save, CheckCircle2 } from "lucide-react";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Banner } from "../components/ui/Banner";
import { useAnalysis } from "../context/AnalysisContext";
import { aegisApi } from "../lib/api";

export const SettingsPage: React.FC = () => {
  const { settings, secretsStatus, refreshSystem } = useAnalysis();

  const [detectifKey, setDetectifKey] = useState("");
  const [groqKey, setGroqKey] = useState("");
  const [detectifBaseUrl, setDetectifBaseUrl] = useState("");
  const [groqSttModel, setGroqSttModel] = useState("whisper-large-v3-turbo");
  const [groqLlmModel, setGroqLlmModel] = useState("llama-3.3-70b-versatile");

  const [appMode, setAppMode] = useState<"REAL" | "DEMO">("REAL");
  const [cacheEnabled, setCacheEnabled] = useState(true);
  const [botGuardEnabled, setBotGuardEnabled] = useState(true);
  const [botGuardThreshold, setBotGuardThreshold] = useState(40);
  const [language, setLanguage] = useState("en");

  const [cacheStats, setCacheStats] = useState<Record<string, unknown> | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadCache = async () => {
    try {
      const stats = await aegisApi.getCacheStats();
      setCacheStats(stats);
    } catch {
      // ignore if backend down
    }
  };

  useEffect(() => {
    void loadCache();
  }, []);

  useEffect(() => {
    if (settings) {
      setAppMode(settings.app_mode);
      setCacheEnabled(settings.cache_enabled);
      setBotGuardEnabled(settings.bot_guard_enabled);
      setBotGuardThreshold(settings.bot_guard_threshold);
      setLanguage(settings.language || "en");
      setDetectifBaseUrl(settings.detectifai_base_url || "https://platform.detectif.ai");
      setGroqSttModel(settings.groq_stt_model || "whisper-large-v3-turbo");
      setGroqLlmModel(settings.groq_llm_model || "llama-3.3-70b-versatile");
    }
  }, [settings]);

  const handleSaveSecrets = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setStatusMessage(null);
    setErrorMessage(null);
    try {
      await aegisApi.updateSecrets({
        detectif_api_key: detectifKey.trim() || undefined,
        groq_api_key: groqKey.trim() || undefined,
        detectif_api_base_url: detectifBaseUrl.trim() || undefined,
        groq_stt_model: groqSttModel.trim() || undefined,
        groq_llm_model: groqLlmModel.trim() || undefined,
      });
      setDetectifKey("");
      setGroqKey("");
      await refreshSystem();
      setStatusMessage("API keys updated in server-only secret store (`data/secrets.local.json`, chmod 0600).");
    } catch (err: unknown) {
      setErrorMessage(
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : "Failed to save server secrets."
      );
    } finally {
      setBusy(false);
    }
  };

  const handleClearSecrets = async () => {
    setBusy(true);
    setStatusMessage(null);
    setErrorMessage(null);
    try {
      await aegisApi.clearSecrets();
      await refreshSystem();
      setStatusMessage("Cleared runtime secrets file (reverting to server environment variables if set).");
    } catch (err: unknown) {
      setErrorMessage(
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : "Failed to clear secrets."
      );
    } finally {
      setBusy(false);
    }
  };

  const handleSaveRuntimeSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setStatusMessage(null);
    setErrorMessage(null);
    try {
      await aegisApi.updateSettings({
        app_mode: appMode,
        cache_enabled: cacheEnabled,
        bot_guard_enabled: botGuardEnabled,
        bot_guard_threshold: botGuardThreshold,
        language,
      });
      await refreshSystem();
      await loadCache();
      setStatusMessage("Runtime configuration updated cleanly.");
    } catch (err: unknown) {
      setErrorMessage(
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : "Failed to update settings."
      );
    } finally {
      setBusy(false);
    }
  };

  const handleClearCache = async () => {
    setBusy(true);
    setStatusMessage(null);
    try {
      const res = await aegisApi.clearCache();
      await loadCache();
      setStatusMessage(`Cleared ${res.cleared_entries} cached SHA-256 inference entry/entries.`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">AEGIS Runtime &amp; Server API Key Settings</h1>
        <p className="body-text">
          Configure DetectifAI &amp; Groq Whisper + LLM API keys (stored exclusively on the backend server),
          fusion policy, cache controls, and Bot Guard automation.
        </p>
      </div>

      {statusMessage && (
        <Banner variant="info" title="Saved">
          {statusMessage}
        </Banner>
      )}
      {errorMessage && (
        <Banner variant="error" title="Settings Error">
          {errorMessage}
        </Banner>
      )}

      {/* Server-side API Keys */}
      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-[var(--brand-steel)]" />
            <h2 className="section-title">Server-Side API Credentials (Zero Browser Storage)</h2>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={secretsStatus?.detectifai_configured ? "success" : "danger"}>
              DetectifAI: {secretsStatus?.detectifai_configured ? `SET (${secretsStatus.detectif_key_hint})` : "NOT SET"}
            </Badge>
            <Badge variant={secretsStatus?.groq_configured ? "success" : "warning"}>
              Groq Whisper + LLM: {secretsStatus?.groq_configured ? `SET (${secretsStatus.groq_key_hint})` : "NOT SET"}
            </Badge>
          </div>
        </div>

        <p className="caption-text">
          Keys submitted here are transmitted once over HTTPS/localhost and persisted solely on the
          backend (`data/secrets.local.json`, never in browser localStorage, IndexedDB, or JS bundles).
        </p>

        <form onSubmit={handleSaveSecrets} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block space-y-1.5">
            <span className="text-[14px] font-semibold text-[var(--text-primary)]">
              DetectifAI API Key (`DETECTIF_API_KEY`)
            </span>
            <input
              type="password"
              value={detectifKey}
              onChange={(e) => setDetectifKey(e.target.value)}
              placeholder="Paste DetectifAI API key to overwrite"
              autoComplete="off"
              className="w-full h-10 px-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] font-mono text-[14px]"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-[14px] font-semibold text-[var(--text-primary)]">
              Groq API Key (`GROQ_API_KEY`, Groq Whisper + LLM)
            </span>
            <input
              type="password"
              value={groqKey}
              onChange={(e) => setGroqKey(e.target.value)}
              placeholder="Paste Groq API key to overwrite"
              autoComplete="off"
              className="w-full h-10 px-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] font-mono text-[14px]"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-[14px] font-semibold text-[var(--text-primary)]">
              DetectifAI Base URL
            </span>
            <input
              type="text"
              value={detectifBaseUrl}
              onChange={(e) => setDetectifBaseUrl(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] font-mono text-[14px]"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-[14px] font-semibold text-[var(--text-primary)]">
              Groq STT &amp; LLM Models (`GROQ_STT_MODEL` / `GROQ_LLM_MODEL`)
            </span>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={groqSttModel}
                onChange={(e) => setGroqSttModel(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] font-mono text-[13px]"
              />
              <input
                type="text"
                value={groqLlmModel}
                onChange={(e) => setGroqLlmModel(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] font-mono text-[13px]"
              />
            </div>
          </label>

          <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-3 pt-2">
            <Button
              type="button"
              variant="danger"
              disabled={busy}
              onClick={handleClearSecrets}
              icon={<Trash2 className="w-4 h-4" />}
            >
              Clear Runtime Key File
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={busy}
              icon={<CheckCircle2 className="w-4 h-4" />}
            >
              Save API Credentials Server-Side
            </Button>
          </div>
        </form>
      </Card>

      {/* Runtime Policy, Bot Guard & Localization */}
      <Card className="space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-[var(--brand-steel)]" />
          <h2 className="section-title">Pipeline Policy, Bot Guard &amp; Locale</h2>
        </div>

        <form onSubmit={handleSaveRuntimeSettings} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <label className="block space-y-1.5">
            <span className="text-[14px] font-semibold">Default Server Mode</span>
            <select
              value={appMode}
              onChange={(e) => setAppMode(e.target.value as "REAL" | "DEMO")}
              className="w-full h-10 px-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[14px]"
            >
              <option value="REAL">REAL (Live DetectifAI &amp; Groq)</option>
              <option value="DEMO">DEMO (Fixtures Only)</option>
            </select>
          </label>

          <label className="block space-y-1.5">
            <span className="text-[14px] font-semibold">Bot Guard Pause Threshold</span>
            <input
              type="number"
              min={10}
              max={90}
              value={botGuardThreshold}
              onChange={(e) => setBotGuardThreshold(Number(e.target.value))}
              className="w-full h-10 px-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] font-mono text-[14px]"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-[14px] font-semibold">Report Language</span>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[14px]"
            >
              <option value="en">English (en)</option>
              <option value="es">Spanish (es)</option>
              <option value="fr">French (fr)</option>
              <option value="de">German (de)</option>
            </select>
          </label>

          <div className="space-y-2 pt-2">
            <label className="flex items-center gap-2 text-[14px] cursor-pointer">
              <input
                type="checkbox"
                checked={botGuardEnabled}
                onChange={(e) => setBotGuardEnabled(e.target.checked)}
                className="w-4 h-4"
              />
              <span>Enable Voice Bot Guard</span>
            </label>
            <label className="flex items-center gap-2 text-[14px] cursor-pointer">
              <input
                type="checkbox"
                checked={cacheEnabled}
                onChange={(e) => setCacheEnabled(e.target.checked)}
                className="w-4 h-4"
              />
              <span>Enable CACHED Mode SHA-256 Cache</span>
            </label>
          </div>

          <div className="md:col-span-2 lg:col-span-4 flex justify-end pt-2">
            <Button type="submit" variant="primary" disabled={busy} icon={<Save className="w-4 h-4" />}>
              Update Policy Settings
            </Button>
          </div>
        </form>
      </Card>

      {/* Cache Controls */}
      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-[var(--brand-steel)]" />
            <div>
              <h2 className="section-title">SHA-256 Inference Cache Controls</h2>
              <p className="caption-text">
                DetectifAI calls bypass cache in LIVE mode; Groq audio transcripts/LLM analyses are cached by SHA-256 to avoid duplicate work.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={handleClearCache}
            icon={<Trash2 className="w-4 h-4" />}
          >
            Purge Cache
          </Button>
        </div>
        {cacheStats && (
          <pre className="p-3 rounded-lg border border-[var(--border)] bg-[var(--fill-subtle)] text-[12px] font-mono overflow-x-auto">
            {JSON.stringify(cacheStats, null, 2)}
          </pre>
        )}
      </Card>
    </div>
  );
};
