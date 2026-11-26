# AEGIS — The Trust Layer

AEGIS (**Automated Evaluation & Guard for Identity & Speech**) is a real-time banking voice authentication and call security platform designed for bank Security Operations Centres (SOC) and automated customer support desks. It protects financial institutions against neural voice clones, pre-recorded playback attacks, and live human social-engineering fraud by combining four explainable trust signals, dynamic anti-replay Challenge Liveness, and sub-second automated Bot Guard interception.

---

## Architecture

AEGIS follows a strict backend-first, three-tier security architecture so API credentials (`DETECTIF_API_KEY`, `GROQ_API_KEY`) never reach the browser:

```text
Customer / Microphone / Scenario Stream
                 │
                 ▼
      React SOC Dashboard (Vite :5173)
        ├── /            3-Panel Call Security Console + Live Call Modal
        ├── /voiceprints Consent-Gated Eidos Voiceprint Library
        ├── /reports     Auditable Post-Call Reports + JSON / PDF Print + Language Switcher
        ├── /deploy      Banking Deployment Blueprint + Community Threat Registry
        └── /stage       20ft Projector Stage Mode (Shortcut: P)
                 │  /api/* HTTP Proxy
                 ▼
      FastAPI Security Layer (Uvicorn :8000)
        ├── Aletheia Service   — 4–120s WAV duration checks, 5s sliding-window deepfake detection
        ├── Eidos Service      — Speaker identity matching (neutral 50.0 baseline if unenrolled)
        ├── Scam Risk Engine   — Groq Whisper + LLM + 9-category deterministic keyword & coercion fallback
        ├── Challenge Engine   — Random nonce phrase + 5-point anti-replay liveness verification
        ├── Trust Engine       — 4-Layer Weighted Composite Trust Score (35% / 30% / 20% / 15%)
        ├── Bot Guard          — Threshold monitoring (<40 or Liveness FAILED) + operator resume lock
        └── JSON Persistence   — Local call store, response cache, voiceprints, reports, threat registry
```

### Trust Score Formula

`services/trust_engine.py` computes an explainable `0–100` composite Trust Score:

```text
TRUST SCORE =
    ((1 - Synthetic Probability) × 100) × 0.35   [Layer 1: Voice Authenticity — Aletheia]
  + (Speaker Match %)                   × 0.30   [Layer 2: Speaker Identity — Eidos; 50.0 neutral if unenrolled]
  + (100 - Scam Risk Score)             × 0.20   [Layer 3: Scam Safety — Groq LLM / deterministic fallback]
  + (100 - Behavioral Pressure Score)   × 0.15   [Layer 4: Behavioral Safety — urgency, secrecy, threats]
```

**Verdict Thresholds:**
- `75.00 – 100.00`: `SAFE`
- `40.00 – 74.99`: `CAUTION`
- `0.00 – 39.99`: `THREAT`

**Challenge Liveness Override:** If Challenge Liveness fails, AEGIS preserves the mathematical Trust Score for transparency while overriding the Final Security Decision to `THREAT` and activating Bot Guard.

---

## Key Features

- **Three-Panel SOC Dashboard (`/`)**: Caller Intelligence, Voiceprint Match ring, interactive highlighted transcript, animated Trust Score radial gauge with clickable per-layer formula breakdowns, 5-second segment evidence timeline, acoustic waveform profile, SOC response actions, and live security alerts.
- **Challenge Liveness Modal**: Generates fresh unpredictable 3-word phrases per challenge (e.g., `"Repeat: cobalt mango seven."`), rejects non-live typed text probes, enforces response window timeouts, catches pre-recorded replay attacks (`S3`), and supports Web Speech API / audio capture plus clearly labeled simulation controls.
- **AEGIS Bot Guard & Human Takeover**: Speaks automated bank prompts via browser `speechSynthesis`, automatically executes `speechSynthesis.cancel()` + locks bot speech when Trust Score drops below the configurable threshold (default `40`) or Challenge Liveness fails, and logs `TRANSFER_TO_HUMAN` actions into the timeline and forensic report.
- **Voiceprint Library (`/voiceprints`)**: Explicit consent-confirmed enrollment, optional mic/audio upload to Eidos, speaker verification modal, verification attempt history, and enrollment revocation.
- **Post-Call Reports (`/reports`)**: Searchable/filterable call history, four-layer formula breakdown, chronological event + segment timeline, actionable recommendations, JSON download, browser print-to-PDF, and interactive multi-language verdict switching (`EN`, `ES`, `FR`, `DE`).
- **Banking Deployment & Threat Registry (`/deploy`)**: Interactive SIPREC / Twilio Media Streams architecture blueprint (`PROPOSED BLUEPRINT`) and anonymized SHA-256 Community Threat Intelligence sharing registry.
- **Presentation Stage Mode (`/stage`, key `P`)**: High-contrast projector display with animated verdict states and `ESC` return.
- **Live Microphone & Upload Analysis (`LIVE CALL`)**: Captures real microphone audio (`>= 4s` validation), live `SpeechRecognition` transcript, and executes the 5-stage analysis pipeline in `DEMO`/`CACHED`/`REAL` modes.

---

## Technology Stack

- **Frontend**: React 19, TypeScript, Vite 6, Tailwind CSS v4, React Router v7, Recharts, Lucide React
- **Backend**: Python, FastAPI, Pydantic v2, Pydantic Settings, HTTPX, Uvicorn
- **AI Integrations**: DetectifAI (Aletheia Deepfake Detection + Eidos Speaker Verification) and Groq Cloud (Whisper STT + Llama/GPT-OSS transcript social-engineering & coercion analysis)
- **Persistence**: Local JSON repositories and SHA-256 request response cache in `data/`

---

## Environment Configuration

Copy `.env.example` in the repository root to `.env`:

```bash
cp .env.example .env
```

Variables (read strictly server-side by `backend/app/core/config.py`):

| Variable | Default | Description |
| --- | --- | --- |
| `DETECTIF_API_KEY` | `""` | Server-side API key for DetectifAI Aletheia & Eidos |
| `DETECTIF_API_BASE_URL` | `https://platform.detectif.ai` | Base URL for DetectifAI APIs |
| `GROQ_API_KEY` | `""` | Server-side API key for Groq (Whisper STT + LLM) |
| `GROQ_STT_MODEL` | `whisper-large-v3-turbo` | Groq speech-to-text model identifier |
| `GROQ_LLM_MODEL` | `llama-3.3-70b-versatile` | Groq LLM model identifier (with live availability fallback) |
| `APP_MODE` | `DEMO` | `DEMO` (cached scenario fixtures, zero API spend) or `REAL` |
| `CACHE_ENABLED` | `true` | Enables local SHA-256 API response caching in `data/cache/responses/` |

Never commit `.env` or expose API keys in `frontend/`.

---

## Installation & Startup Instructions

### Prerequisites
- Python `3.10+`
- Node.js `18+` and `npm`

### 1. Backend Setup & Run (`AEGIS/backend`)

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Backend API runs on `http://127.0.0.1:8000` (health check: `GET /api/health`).

### 2. Frontend Setup & Run (`AEGIS/frontend`)

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://127.0.0.1:5173` and proxies `/api/*` requests to `http://127.0.0.1:8000`.

> **Port Conflict Note**: If ports `8000` or `5173` are occupied on your host, run backend on another port (`uvicorn app.main:app --reload --port 8001`) and launch frontend with `VITE_PORT=5174 VITE_API_TARGET=http://127.0.0.1:8001 npm run dev`.

---

## Demo Scenario Instructions (Judge Walkthrough Under 60 Seconds)

Ensure header mode is **DEMO** (default; guarantees zero external API consumption):

1. **S1 — Legitimate Enrolled Customer (`Trust Score: 93.70` · `SAFE`)**
   - Click **S1** in the scenario strip.
   - Voice Authenticity `96%`, Speaker Match `94%`, Scam Safety `92%`, Behavioral Safety `90%`. Bot Guard stays `IDLE`; click **Play Bot** to hear the automated greeting.
2. **S2 — AI-Cloned Voice of Enrolled Customer (`Trust Score: 31.35` · `THREAT`)**
   - Click **Demo S2 Interrupt** (or **S2**).
   - Eidos sees `86%` speaker similarity, but Aletheia flags `92%` synthetic probability (`8%` authentic voice). Bot Guard immediately silences speech (`PAUSED BY GUARD`).
3. **S3 — Replayed Genuine Recording (`Score: 95.05` → `THREAT` Override)**
   - Click **S3**. The Challenge Liveness modal opens automatically with a fresh unpredictable phrase while showing that passive score metrics were `95.05 SAFE`.
   - Click **Simulate Replay Attack (S3 Fail)** to show the 5-point liveness pipeline rejecting static playback and overriding Final Decision to `THREAT`.
4. **S4 — Real Human Reading a Scam Script (`Trust Score: 37.75` · `THREAT`)**
   - Click **S4**. Voice is `96%` genuine human, but Speaker Match drops to `8%` and Scam/Behavioral pressure highlight `"OTP"`, `"AnyDesk"`, and `"do not tell"` (`95` risk / `95` pressure).
5. **Operator Escalation & Audit**
   - Click **TRANSFER TO HUMAN** → **Stage Mode** (press **`P`**) → **Reports** (`/reports`) to export JSON or print PDF and switch verdict languages (`EN / ES / FR / DE`).

---

## Real API Configuration

1. Set `DETECTIF_API_KEY` and `GROQ_API_KEY` in root `.env`.
2. Restart the FastAPI backend so `Settings` reloads `.env`.
3. Switch the header toggle from **DEMO** to **REAL** (or submit `analysis_mode=REAL` via **LIVE CALL**).
4. **Strict Integrity Guarantee**: If `DETECTIF_API_KEY` is missing or an external API call fails/times out in `REAL` mode, AEGIS reports `UNAVAILABLE` and `INCOMPLETE ANALYSIS` honestly—it never fabricates `SAFE` or simulated biometric scores as `REAL ANALYSIS`.

---

## Known Limitations

- **Telephony Simulation**: The `/deploy` topology diagram illustrates a proposed enterprise SIPREC / Twilio Media Streams architecture; no external bank PBX or PSTN carrier trunk is connected in this prototype.
- **Browser Speech APIs**: Live microphone speech-to-text (`SpeechRecognition` / `webkitSpeechRecognition`) and `speechSynthesis` Bot Guard playback depend on Chromium/Chrome/Edge browser support and explicit microphone permissions. Unsupported browsers gracefully fall back to audio file upload (`LIVE CALL`) and visual Bot Guard status states.
- **Threat Registry Scope**: The Community Threat Intelligence Registry (`/deploy`) stores SHA-256 anonymized entries in local JSON (`data/cache/threat_registry.json`) rather than a distributed multi-bank federated ledger.
- **JSON Persistence**: Call sessions, voiceprints, settings, and reports are stored in local JSON files (`data/cache/`, `data/reports/`), suitable for single-node SOC demonstrations rather than multi-worker concurrent production databases.
