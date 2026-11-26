import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const SCREENSHOT_DIR =
  "/home/laxmi/.gemini/antigravity/brain/17eb7bbf-a030-4cea-8b62-1182ab5a6197/screenshots";

function buildMockScenarioSession(id: string) {
  const decision =
    id === "S1" ? "ALLOW" : id === "S2" ? "END_CALL" : id === "S3" ? "STEP_UP" : "STEP_UP";
  const trustScore = id === "S1" ? 92 : id === "S2" ? 12 : id === "S3" ? 48 : 38;
  return {
    call_id: `CALL-MOCK-${id}`,
    created_at: "2026-11-26T01:00:00Z",
    timestamp: "2026-11-26T01:00:00Z",
    scenario_id: id,
    caller_label: id === "S2" ? "Valeria Chen" : "Marcus Vance",
    claimed_customer_id: id === "S2" ? "CUST-8831-VALERIA" : "CUST-4821-MARCUS",
    caller_profile: {
      caller_phone_id: "+1 (415) 555-0142",
      claimed_name: id === "S2" ? "Valeria Chen" : "Marcus Vance",
      account_ref_masked: "•••• 4821",
      call_duration_sec: 12,
      verification_status: decision === "ALLOW" ? "VERIFIED" : "REVIEW",
    },
    call_state: "VERDICT",
    mode: "DEMO",
    execution_mode: "DEMO",
    analysis_mode: "SIMULATION",
    overall_provenance: "SIMULATION",
    synthetic_probability: id === "S2" ? 0.99 : 0.04,
    voice_authenticity_score: id === "S2" ? 1 : 96,
    speaker_match_percentage: id === "S1" ? 91 : 40,
    scam_risk_score: id === "S4" ? 88 : 10,
    behavioral_pressure_score: id === "S4" ? 92 : 8,
    trust_score: trustScore,
    verdict: trustScore >= 75 ? "SAFE" : trustScore >= 45 ? "CAUTION" : "THREAT",
    band: trustScore >= 75 ? "SAFE" : trustScore >= 45 ? "REVIEW" : "THREAT",
    decision,
    decision_reason: `Demo fixture ${id} verdict (${decision})`,
    model_status: {
      asr: "OK",
      aletheia: "OK",
      eidos: id === "S2" ? "SKIPPED" : "OK",
      scam_analysis: "OK",
      manipulation: "OK",
    },
    voice_authenticity: {
      status: "PASS",
      deepfake_probability: id === "S2" ? 0.99 : 0.04,
      score: id === "S2" ? 1 : 96,
      model_name: "aletheia",
      artifacts_detected: [],
      provenance: "SIMULATION",
      detail: "Fixture result",
      cache_hit: false,
    },
    speaker_identity: {
      status: id === "S2" ? "SKIPPED" : "PASS",
      score: id === "S1" ? 91 : 40,
      match_confidence: id === "S1" ? 91 : 40,
      claimed_customer_id: "CUST-4821-MARCUS",
      enrolled: true,
      skip_reason: id === "S2" ? "aletheia_fake" : null,
      model_name: "eidos",
      provenance: "SIMULATION",
      detail: "Fixture result",
      cache_hit: false,
    },
    scam_analysis: {
      status: "PASS",
      risk_score: id === "S4" ? 88 : 10,
      safety_score: id === "S4" ? 12 : 90,
      behavioral_pressure_score: id === "S4" ? 92 : 8,
      categories: [],
      detected_patterns: [],
      pressure_tactics: [],
      flagged_phrases: [],
      engine_used: "groq",
      provenance: "SIMULATION",
      summary: "Fixture summary",
      recommended_action: "Fixture action",
      fallback_used: false,
      cache_hit: false,
    },
    manipulation_analysis: {
      status: "PASS",
      score: id === "S4" ? 92 : 8,
      safety_score: id === "S4" ? 8 : 92,
      model_version: "1.0",
      category_counts: {},
      markers: [],
      sparkline: [10, 20, 35],
      provenance: "SIMULATION",
    },
    liveness: {
      passed: id === "S1",
      replay_detected: id === "S3",
      score: id === "S1" ? 95 : 20,
      status: id === "S1" ? "PASS" : "FAIL",
      signal_notes: "Fixture",
      provenance: "SIMULATION",
    },
    trust_breakdown: {
      composite_score: trustScore,
      score_based_verdict: trustScore >= 75 ? "SAFE" : "CAUTION",
      verdict: trustScore >= 75 ? "SAFE" : "THREAT",
      final_decision: trustScore >= 75 ? "SAFE" : "THREAT",
      band: trustScore >= 75 ? "SAFE" : trustScore >= 45 ? "REVIEW" : "THREAT",
      decision,
      liveness_override_applied: id === "S3",
      liveness_status: id === "S1" ? "PASSED" : "FAILED",
      formula_summary: "0.35*L1 + 0.30*L2 + 0.20*L3 + 0.15*L4",
      recommended_action: `Demo fixture ${id}`,
      factor_contributions: [],
      primary_risk_drivers: [],
    },
    transcript: [],
    evidence_timeline: [],
    segment_chunks: [],
    audio_profile: {
      pitch_hz: 120,
      jitter_pct: 1.2,
      harmonic_noise_ratio_db: 22,
      spectral_flatness: 0.1,
      synthetic_cadence_index: 0.1,
      replay_echo_correlation: 0.1,
    },
    actions_taken: [],
    credits_saved: id === "S2" ? 500 : 0,
  };
}

async function setupApiMocks(page: Page) {
  await page.route("**/api/**", async (route) => {
    const url = route.request().url();
    if (url.includes("/health")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "ok",
          service: "AEGIS",
          version: "2.0",
          app_mode: "DEMO",
          cache_enabled: true,
          detectifai_configured: true,
          groq_configured: true,
          detectifai: "SET",
          groq: "SET",
          active_calls_count: 1,
          voiceprints_count: 2,
          real_mode_note: "Mocked",
        }),
      });
      return;
    }
    if (url.includes("/settings")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          app_mode: "DEMO",
          cache_enabled: true,
          bot_guard_enabled: true,
          bot_guard_threshold: 55,
          layer_weights: {
            voice_authenticity: 0.35,
            speaker_identity: 0.3,
            scam_safety: 0.2,
            behavioral_safety: 0.15,
          },
          safe_threshold: 75,
          review_threshold: 45,
          ema_alpha: 0.35,
          language: "en",
          detectifai_configured: true,
          groq_configured: true,
          detectifai_base_url: "https://platform.detectif.ai",
          groq_stt_model: "whisper-large-v3",
          groq_llm_model: "llama-3.3-70b-versatile",
        }),
      });
      return;
    }
    if (url.includes("/secrets-status")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          detectifai_configured: true,
          groq_configured: true,
          detectif_key_hint: "dtf_***",
          groq_key_hint: "gsk_***",
          detectifai_base_url: "https://platform.detectif.ai",
          groq_stt_model: "whisper-large-v3",
          groq_llm_model: "llama-3.3-70b-versatile",
        }),
      });
      return;
    }
    if (url.includes("/credits")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          available: 3400,
          reserved: 0,
          currency: "credits",
          configured: true,
          latency_ms: 12,
        }),
      });
      return;
    }
    if (url.includes("/scenarios/run")) {
      const body = route.request().postDataJSON() as { scenario_id?: string };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(buildMockScenarioSession(body?.scenario_id || "S1")),
      });
      return;
    }
    if (url.includes("/scenarios")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
      return;
    }
    if (url.includes("/voiceprints")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            voiceprint_id: "vp-marcus-1",
            customer_id: "CUST-4821-MARCUS",
            customer_name: "Marcus Vance",
            account_tier: "Private Wealth",
            enrollment_purpose: "Auth",
            consent_confirmed: true,
            consent_timestamp: "2026-11-25T10:00:00Z",
            retention_policy: "90 days",
            enrolled_at: "2026-11-25T10:00:00Z",
            sample_duration_sec: 8,
            enrollment_source: "REAL ANALYSIS",
            provider_speaker_id: "spk_live_marcus",
            last_verification_status: "VERIFIED",
            verification_count: 2,
            mismatch_count: 0,
            verification_history: [],
            status: "ACTIVE",
          },
        ]),
      });
      return;
    }
    if (url.includes("/usage")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          credit_balance: 3400,
          total_calls_analyzed: 4,
          total_credits_used: 0,
          total_credits_saved: 500,
          burn_rate_per_call: 0,
          aletheia_calls: 0,
          eidos_calls: 0,
          groq_calls: 0,
          cache_hits: 0,
          fresh_calls: 0,
          operations: [],
        }),
      });
      return;
    }
    if (url.includes("/action")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ call_id: "CALL-MOCK-S1", updated_status: "OK" }),
      });
      return;
    }
    if (url.includes("/calls/CALL-MOCK-")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(buildMockScenarioSession("S1")),
      });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
}

test.beforeAll(() => {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
});

test("walks through phone states S1-S4, Stage Mode, captures screenshots, and passes responsive zero-console audit", async ({
  page,
}) => {
  const consoleIssues: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning") {
      consoleIssues.push(`[${msg.type()}] ${msg.text()}`);
    }
  });
  page.on("pageerror", (err) => {
    consoleIssues.push(`[pageerror] ${err.message}`);
  });

  await setupApiMocks(page);

  // 1. Desktop 1920x1080 Analyze + Docked PhonePanel walkthrough
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/analyze", { waitUntil: "networkidle" });

  // Idle state screenshot
  await expect(page.getByTestId("caller-phone-screen")).toHaveAttribute("data-screen-state", "idle");
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "01-desktop-idle-caller.png") });

  // Switch to Side by side view and simulate incoming call (ringing)
  await page.getByRole("tab", { name: "Side by side" }).click();
  await page.getByRole("button", { name: "Simulate incoming call" }).click();
  await expect(page.getByTestId("caller-phone-screen")).toHaveAttribute("data-screen-state", "incoming_ringing");
  await expect(page.getByTestId("agent-phone-screen")).toHaveAttribute("data-screen-state", "incoming_ringing");
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "02-desktop-incoming-sidebyside.png") });

  // Agent accepts call -> transitions to verified -> Hold -> Transfer -> With Agent -> Hangup
  await page.getByRole("button", { name: "Accept incoming call" }).click();
  await expect(page.getByTestId("caller-phone-screen")).toHaveAttribute("data-screen-state", "connected_verified", {
    timeout: 4000,
  });
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "03-desktop-verified-sidebyside.png") });

  const agentPhone = page.getByTestId("agent-phone-screen");
  await agentPhone.getByRole("button", { name: "Pause bot" }).click();
  await expect(page.getByTestId("caller-phone-screen")).toHaveAttribute("data-screen-state", "on_hold");
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "04-desktop-onhold-sidebyside.png") });

  await agentPhone.getByRole("button", { name: "Transfer call to human" }).click();
  await expect(page.getByTestId("caller-phone-screen")).toHaveAttribute("data-screen-state", "transferring");
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "05-desktop-transferring.png") });

  await expect(page.getByTestId("caller-phone-screen")).toHaveAttribute("data-screen-state", "with_agent", {
    timeout: 4000,
  });
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "06-desktop-with-agent.png") });

  // Missed call manual trigger
  await page.getByRole("button", { name: "Caller does not answer (missed)" }).click();
  await expect(page.getByTestId("caller-phone-screen")).toHaveAttribute("data-screen-state", "ended");
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "07-desktop-ended-missed.png") });

  // S1 full run at 2x speed -> verified -> caller_hung_up
  const select = page.getByLabel("Simulation scenario");
  await select.selectOption("S1");
  await page.getByRole("button", { name: "Toggle playback speed" }).click(); // 2x
  await page.getByRole("button", { name: "Play scenario" }).click();
  await expect(page.getByTestId("caller-phone-screen")).toHaveAttribute("data-screen-state", "ended", {
    timeout: 8000,
  });
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "08a-desktop-s1-caller-hungup.png") });

  // S2 -> security_end
  await select.selectOption("S2");
  await page.getByRole("button", { name: "Play scenario" }).click();
  await expect(page.getByTestId("caller-phone-screen")).toHaveAttribute("data-screen-state", "ended", {
    timeout: 8000,
  });
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "08-desktop-s2-security-end.png") });

  // S4 restricted + coercive phrase bubbles on Agent phone + operator End Call preemption
  await select.selectOption("S4");
  for (let i = 0; i < 5; i++) {
    await page.getByRole("button", { name: "Step next scenario beat" }).click();
  }
  await expect(page.getByTestId("caller-phone-screen")).toHaveAttribute("data-screen-state", "connected_restricted");
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "09-desktop-s4-restricted-coercive.png") });

  // S3 step through to challenge_pending & verify zero forbidden words on Caller Phone
  await page.getByRole("button", { name: "Reset scenario" }).click();
  await select.selectOption("S3");
  for (let i = 0; i < 5; i++) {
    await page.getByRole("button", { name: "Step next scenario beat" }).click();
  }
  await expect(page.getByTestId("caller-phone-screen")).toHaveAttribute("data-screen-state", "challenge_pending");
  const callerText = await page.getByTestId("caller-phone-screen").innerText();
  expect(callerText).not.toMatch(/\b(fraud|deepfake|scores?|tactics?)\b/i);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "10-desktop-s3-challenge-pending.png") });

  // Stage mode verification
  await page.goto("/stage", { waitUntil: "networkidle" });
  await expect(page.getByTestId("caller-phone-screen")).toBeVisible();
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "11-stage-mode-phone.png") });

  // Mobile drawer verification at 390px
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/analyze", { waitUntil: "domcontentloaded" });
  const openDrawerBtn = page.getByRole("button", { name: "Open Phone preview" });
  await expect(openDrawerBtn).toBeVisible();
  await openDrawerBtn.click();
  const drawer = page.getByRole("dialog", { name: "Phone Preview Drawer" });
  await expect(drawer).toBeVisible();
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "12-mobile-phone-drawer.png") });
  await drawer.getByRole("tab", { name: "Agent phone" }).click();
  await expect(drawer.getByTestId("agent-phone-screen")).toBeVisible();
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "13-mobile-agent-drawer.png") });
  await drawer.getByRole("button", { name: "Close phone drawer" }).click();

  expect(consoleIssues).toEqual([]);
});

test("passes zero console errors/warnings and zero horizontal overflow across all routes (360px..2560px)", async ({
  page,
}) => {
  const consoleIssues: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning") {
      consoleIssues.push(`[${msg.type()}] ${msg.text()}`);
    }
  });
  page.on("pageerror", (err) => {
    consoleIssues.push(`[pageerror] ${err.message}`);
  });

  await setupApiMocks(page);

  const routes = ["/live-demo", "/analyze", "/intelligence", "/trust-score", "/voiceprints", "/usage"];
  const widths = [2560, 1920, 1440, 1024, 390, 360];
  for (const w of widths) {
    await page.setViewportSize({ width: w, height: 900 });
    for (const r of routes) {
      await page.goto(r, { waitUntil: "domcontentloaded" });
      await expect(page.locator("main")).toBeVisible();
      const noOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth <= window.innerWidth + 1;
      });
      expect(noOverflow, `Horizontal overflow on ${r} at ${w}px`).toBe(true);
    }
  }

  // Layout non-clipping check at 1440px, 1280px, and 1024px on /analyze
  for (const [w, h] of [
    [1440, 900],
    [1280, 800],
    [1024, 768],
  ] as const) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto("/analyze", { waitUntil: "domcontentloaded" });
    await expect(page.locator("main")).toBeVisible();
    const analyzeBtn = page.getByRole("button", { name: /Analyze/i }).first();
    const box = await analyzeBtn.boundingBox();
    expect(box, `Missing Analyze button at ${w}px`).not.toBeNull();
    // Single-line button height <= 46px and completely within viewport
    expect(box!.height).toBeLessThanOrEqual(46);
    expect(box!.x + box!.width).toBeLessThanOrEqual(w + 1);
  }

  expect(consoleIssues).toEqual([]);
});
