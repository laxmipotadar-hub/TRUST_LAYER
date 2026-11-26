# STEP 0 — AEGIS Backend Audit & Feature-to-UI Status Map

Audited directly against `backend/app/` and `frontend/src/` prior to Step 1 edits.

---

## 1. Backend Inventory

### A. REST Routers (`backend/app/main.py` prefix `/api`)
| Module | Endpoint | Request / Response Schema | Notes |
| --- | --- | --- | --- |
| `main.py` | `GET /` | `dict[str, str]` | Root service banner |
| `health.py` | `GET /api/health` | `HealthResponse` | `status`, `app_mode`, `cache_enabled`, `detectifai_configured`, `groq_configured`, `detectifai`, `groq`, `active_calls_count`, `voiceprints_count`, `real_mode_note` |
| `health.py` | `GET /api/settings` | `SettingsResponse` | Bot Guard + app mode + provider booleans + URL/model |
| `health.py` | `POST /api/settings` | `SettingsUpdateRequest` -> `SettingsResponse` | Updates `app_mode`, `cache_enabled`, `bot_guard_enabled`, `bot_guard_threshold` |
| `health.py` | `GET /api/cache/stats` | `dict` | Cache entry count / disk usage |
| `health.py` | `DELETE /api/cache` | `dict` | Clears cached entries |
| `scenarios.py` | `GET /api/scenarios` | `ScenarioDefinition[]` | `S1`, `S2`, `S3`, `S4` |
| `scenarios.py` | `POST /api/scenarios/run` | `ScenarioRunRequest` -> `CallSession` | Runs `S1..S4` via `analyze_scenario_call` |
| `calls.py` | `GET /api/calls` | `CallSession[]` | Historical calls (`limit`) |
| `calls.py` | `GET /api/calls/current` | `CallSession` | Most recent call |
| `calls.py` | `POST /api/calls/analyze` | Multipart (`file`, `transcript_text`, `claimed_customer_id`, `caller_label`, `analysis_mode`, `duration_hint_sec`) -> `UnifiedCallAnalysisResponse` | Coordinates Aletheia, Eidos, Scam/Manipulation, Trust Engine |
| `calls.py` | `GET /api/calls/{call_id}` | `CallSession` | Call lookup |
| `calls.py` | `GET /api/calls/{call_id}/report` | `CallReportResponse` | Executive summary, recommendations, multilingual verdicts (`en/es/fr/de`), full `call_session` |
| `calls.py` | `POST /api/calls/{call_id}/action` | `CallActionRequest` -> `CallActionResponse` | Logs `ALLOW`, `CHALLENGE`, `PAUSE_BOT`, `TRANSFER_TO_HUMAN`, `BLOCK_CALL`, `STEP_UP_CHALLENGE`, `FREEZE_ACCOUNT`, `ESCALATE_SOC`, `TERMINATE_CALL` |
| `voiceprints.py` | `GET /api/voiceprints` | `VoiceprintRecord[]` | Lists `ACTIVE` / `REVOKED` records + `verification_history` |
| `voiceprints.py` | `POST /api/voiceprints/enroll` | `VoiceprintEnrollRequest` -> `VoiceprintRecord` | Simulation enrollment with explicit `consent_confirmed` |
| `voiceprints.py` | `POST /api/voiceprints/enroll-audio` | Multipart (`file`, `customer_id`, `customer_name`, `account_tier`, `enrollment_purpose`, `consent_confirmed`, `sample_duration_sec`) -> `VoiceprintRecord` | Calls `enroll_speaker_eidos` in `REAL` mode |
| `voiceprints.py` | `POST /api/voiceprints/verify` | Multipart (`file`, `claimed_customer_id`, `simulate_outcome`) -> `VoiceprintVerifyResponse` | Calls `verify_speaker_eidos` and appends `verification_history` |
| `voiceprints.py` | `POST /api/voiceprints/{voiceprint_id}/revoke` | `VoiceprintRecord` | Marks `status="REVOKED"` |
| `voiceprints.py` | `DELETE /api/voiceprints/{voiceprint_id}` | `VoiceprintDeleteResponse` | Deletes record locally |
| `challenge.py` | `POST /api/challenge/start` | `ChallengeStartRequest` -> `ChallengeSession` | Cryptographic 3-word phrase + expiry (`window_seconds`) |
| `challenge.py` | `POST /api/challenge/verify` | `ChallengeVerifyRequest` -> `ChallengeVerifyResponse` | 5-point check + optional `CallSession` update |
| `challenge.py` | `POST /api/challenge/verify-audio` | Multipart (`challenge_id`, `spoken_response`, `response_latency_ms`, `capture_mode`, `file`) -> `ChallengeVerifyResponse` | Live audio challenge + Aletheia/Eidos |
| `registry.py` | `GET /api/threat-registry` | `ThreatRegistryResponse` | List threat patterns (`category` filter) |
| `registry.py` | `POST /api/threat-registry` | `ThreatSubmitRequest` -> `ThreatRegistryEntry` | SHA-256 anonymizes speaker ref |
| `registry.py` | `PATCH /api/threat-registry/{entry_id}` | `ThreatStatusUpdateRequest` -> `ThreatRegistryEntry` | Updates `verification_status` |

### B. WebSocket Channels
- **NONE currently present** (Gap: need `WS /api/ws/live-call` for real-time 8–16 kHz PCM/WAV chunk streaming, sequence numbers, heartbeats, live ASR/transcript ingestion, real-time manipulation marker firing, and EMA-smoothed Trust Score fusion).

### C. Service Layers & Config (`backend/app/services/`, `backend/app/core/config.py`)
- **`aletheia_service.py`**: `detect_deepfake_aletheia()` — calls DetectifAI `POST /v1/deepfake/detect`, validates `>= 4.0s`, splits long audio into 5s sliding chunks, parses `verdict`, `score`, `segments`, `request_id`. Gap: does not capture `latency_ms`, raw JSON response, `operation_id`, or `cost_credits` into a ledger, nor bypass cache in `LIVE` mode.
- **`eidos_service.py`**: `enroll_speaker_eidos()`, `verify_speaker_eidos()` — calls DetectifAI `POST /v1/speakers/enroll` and `POST /v1/speakers/verify`, normalizes `similarity` (`-1..1`), `match_confidence`, `score`, neutral `50.0` when unenrolled. Gap: no provider `DELETE /v1/speakers/{id}` call on revoke, no latency/raw JSON/ledger metering, no `LIVE` cache bypass.
- **`scam_analysis_service.py`**: `analyze_scam_transcript()` — Groq LLM structured JSON (`openai/gpt-oss-120b` / configured `GROQ_LLM_MODEL`) + 9-rule deterministic fallback (`THREAT_RULES`) producing `risk_score`, `safety_score`, `behavioral_pressure_score`, `detected_patterns`, `pressure_tactics`, `flagged_phrases`.
- **`trust_engine.py`**: `calculate_trust_score()` — 4-layer weighted sum (`0.35`, `0.30`, `0.20`, `0.15`), `liveness_override_applied`, `build_evidence_timeline()`. Gap: fixed weights/thresholds, no EMA smoothing across live audio chunks, no explicit `Aletheia synthetic + Eidos match -> voice-clone override`, decision uses `SAFE/CAUTION/THREAT` rather than exposing band `SAFE/REVIEW/THREAT` + decision `ALLOW/STEP_UP/BLOCK`.
- **`challenge_service.py`**: `start_challenge_session()`, `verify_challenge_response()`.
- **`report_service.py`**: `generate_call_report()` with `multilingual_verdicts` (`en`, `es`, `fr`, `de`). Gap: no report list endpoint or user feedback (`Was this a scam?`) persistence.
- **`cache_service.py` & `threat_registry.py` & `json_store.py`**: JSON persistence under `data/`.
- **`core/config.py`**: `detectif_api_key`, `detectif_api_base_url`, `groq_api_key`, `groq_stt_model`, `groq_llm_model`, `app_mode`, `cache_enabled`, `cors_origins`, `data_dir`.

---

## 2. FEATURE -> ENDPOINT -> CURRENT UI STATUS MAP

| Feature | Backend Endpoint / Service | Current UI Status | Exact Discrepancies / Gaps Found |
| --- | --- | --- | --- |
| System Health & Mode | `GET /api/health` | **Partially exposed** (`api.ts`) | `api.ts` expects `mode`/`backend_active`/`key_status` (`VITE_API_MODE` defaults to `"mock"`) instead of reading backend fields; defaults to DEMO mock instead of LIVE. |
| API Keys & Settings | `GET/POST /api/settings`, **Missing secrets endpoint** | **Missing** | No Settings page; `BotGuardPanel` threshold/enable toggles never persist via `POST /api/settings`; no server-side API key management endpoint. |
| Cache Stats & Clear | `GET /api/cache/stats`, `DELETE /api/cache` | **Missing** | No UI controls or cache visibility. |
| Scenarios (`S1..S4`) | `GET /api/scenarios`, `POST /api/scenarios/run` | **Partially exposed (broken wiring)** | `ClipBar` triggers `POST /api/calls/analyze` with `scenario_id` instead of `/api/scenarios/run`, falling back to frontend mocks. |
| Call Analysis (4 Layers) | `POST /api/calls/analyze` | **Partially exposed (mismatched schema)** | Frontend renders only 2 layers (`Aletheia`, `Eidos`) and posts `audio`/`claimed_user_id` expecting `{aletheia, eidos, trust_score}` instead of `UnifiedCallAnalysisResponse` (`voice_authenticity`, `speaker_identity`, `scam_analysis`, `trust_breakdown`). |
| Script Analysis (Layer 3) | `scam_analysis_service.py` (in `CallSession.scam_analysis`) | **Missing** | Backend produces `detected_patterns`, `flagged_phrases`, `risk_score`, `engine_used`, `summary`; UI hides transcript highlighting, matched patterns, and LLM evidence completely. |
| Manipulation / Behavioural Analysis (Layer 4) | `scam_analysis_service.py` (`behavioral_pressure_score`, `pressure_tactics`) | **Missing** | UI only renders a bare number in `HeuristicRiskRow`; no marker categories (`urgency`, `secrecy`, `authority`, `threat`), timeline, counts, or sparkline. |
| Composite Trust Score Fusion | `trust_engine.py` (`trust_breakdown`) | **Partially exposed** | `HeuristicRiskRow` shows 4 bars using mock `breakdown`; hides `factor_contributions`, exact weights, formulas, EMA smoothing, and conflict overrides (`voice-clone override`). |
| Operator Actions & Caller Profile | `POST /api/calls/{call_id}/action`, `CallSession.caller_profile` | **Partially exposed (stubbed)** | `OperatorActionsCard` & `BotGuardPanel` only update local React state; never `POST /api/calls/{id}/action`. `CallerCard` uses old `callerMeta` instead of `caller_profile`. |
| Alerts & Evidence Timeline | `CallSession.evidence_timeline`, `segment_chunks` | **Partially exposed** | `AlertsTimelineCard` builds 3 local strings in `AnalysisContext`; ignores `evidence_timeline` & `segment_chunks` returned by backend. |
| Challenge Liveness | `POST /api/challenge/start`, `/verify`, `/verify-audio` | **Partially exposed (mismatched)** | `ChallengeModal` calls `/challenge/verify` with multipart instead of `/challenge/verify-audio` and validates `{nonce, expires_in_seconds}` instead of `{phrase, window_seconds}` & `{passed, checks}`. |
| Voiceprints & Enrollment | `GET /api/voiceprints`, `POST /enroll`, `POST /enroll-audio`, `POST /verify`, `POST /{id}/revoke`, `DELETE /{id}` | **Partially exposed (broken field names)** | UI expects `id`/`claimed_user_id`/`user_name`/`consent_given`/`status:"active"` instead of backend `voiceprint_id`/`customer_id`/`customer_name`/`consent_confirmed`/`status:"ACTIVE"`; UI calls `/enroll` instead of `/enroll-audio` and skips `POST /verify` & `POST /revoke`. |
| Reports & Feedback | `GET /api/calls/{id}/report`, `GET /api/calls` | **Partially exposed** | `ReportsPage` reads `localStorage` only; ignores `GET /api/calls`, `CallReportResponse`, `multilingual_verdicts`, and lacks `"Was this a scam?"` feedback POST. |
| Usage Ledger & Credits | **Missing** (`/api/usage`, `/api/credits`, CSV export) | **Missing (mocked only)** | `UsageDashboard` hits nonexistent `/api/usage` and falls back to mock data; backend lacks real DetectifAI credit proxy, `FRESH`/`CACHED`/`DEMO` ledger persistence, burn rate, and CSV export. |
| Deployment Topology & Threat Registry | `GET/POST/PATCH /api/threat-registry` | **Partially exposed / Missing** | `DeploymentPage` renders outdated 2-check diagram without ASR/4 layers/fusion and completely omits the Threat Registry UI. |
| Live Streaming Demo (8-Step) | **Missing** (`WS /api/ws/live-call`, AudioWorklet) | **Missing** | No sequential 8-step Live Demo flow, no `8–16 kHz` AudioWorklet capture, and no WebSocket pipeline with sequence numbers & heartbeat. |

---

## 3. Canonical Naming Source of Truth (Renames to Standardize)
- **Voiceprints**: `voiceprint_id`, `customer_id`, `customer_name`, `account_tier`, `enrollment_purpose`, `consent_confirmed`, `consent_timestamp`, `provider_speaker_ref`, `provider_operation_id`, `verification_history`, `status` (`ACTIVE` | `REVOKED`)
- **Analyze / Layers**: `voice_authenticity` (Aletheia), `speaker_identity` (Eidos), `scam_analysis` (Layer 3 Script Analysis), `manipulation_analysis` / `behavioral_pressure_score` (Layer 4 Manipulation Analysis), `trust_breakdown` (Fusion), `caller_profile`, `evidence_timeline`, `segment_chunks`, `actions_taken`, `model_status`
- **Decisions & Bands**: `trust_score` (0–100 EMA-ready composite), `band` (`SAFE` | `REVIEW` | `THREAT` alongside legacy `verdict`), `decision` (`ALLOW` | `STEP_UP` | `BLOCK`)
- **Challenge**: `window_seconds`, `phrase`, `spoken_response`, `response_latency_ms`, `checks`, `liveness_status`, `updated_call`
- **Operations Ledger**: `mode` = `FRESH` (in `LIVE` mode) | `CACHED` | `DEMO`, `operation_id`, `cost_credits`, `latency_ms`, `raw_payload`
