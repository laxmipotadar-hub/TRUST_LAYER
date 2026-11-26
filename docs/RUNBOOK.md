# AEGIS Runtime & Live Presentation Runbook

## 1. Starting Backend & Frontend

### Backend (FastAPI + WebSocket, port `8000`)
```bash
cd /home/laxmi/TRUST_LAYER/backend
.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
Verify backend health:
```bash
curl http://localhost:8000/api/health
```

### Frontend (Vite + React + WS Proxy, port `5173`)
```bash
cd /home/laxmi/TRUST_LAYER/frontend
npm run dev
```
Open `http://localhost:5173`. Vite proxies all `/api/*` REST calls and `ws://.../api/ws/live-call` WebSocket connections directly to `http://localhost:8000`.

---

## 2. Where to Paste API Keys (Server-Side Only)

Zero API keys are ever stored in browser storage (`localStorage` / `IndexedDB`) or compiled into `frontend/dist`.

**Option A — In the UI (fastest during a live demo):**
1. Open **Settings** (`/settings`) in the left navigation rail.
2. Paste your **DetectifAI API Key** (`DETECTIF_API_KEY`) and optional **Groq API Key** (`GROQ_API_KEY`).
3. Click **Save API Credentials Server-Side** (`POST /api/settings/secrets`).
   Keys are stored strictly on the backend at `backend/data/secrets.local.json` (`chmod 0600`, gitignored).

**Option B — In `.env` before booting uvicorn:**
Place `DETECTIF_API_KEY=...` and `GROQ_API_KEY=...` in `/home/laxmi/TRUST_LAYER/.env` (or `backend/.env`).

---

## 3. Exact 8-Step Live Demo Presentation Path (`/live-demo`)

Navigate to **Live Demo** (`/live-demo`) in the sidebar. LIVE mode is enforced automatically (`cache_hit = false`, every provider operation recorded as `FRESH`).

1. **Step 1 — Connect**: Click **Verify Backend Health & Credits** (`GET /api/health`, `GET /api/credits`) and **Test Live Microphone** to verify real-time AudioWorklet mic input level.
2. **Step 2 — Enroll**: Enter presenter name & Customer ID, record 3 short voice samples speaking naturally, and click **Enroll Voiceprint** (`concatWavSamplesTo16kBlob` -> `POST /api/voiceprints/enroll-audio`) to receive an active `voiceprint_id`.
3. **Step 3 — Live Aletheia**: Click **Start 16 kHz WS Audio Stream**, speak for 8+ seconds watching the 24-bar SVG waveform + WS frame counter, then click **Stop & Run Live Aletheia** to inspect real DetectifAI `synthetic_likelihood`, `operation_id`, and `latency_ms`.
4. **Step 4 — Live Eidos (Own vs Impostor)**: Record **4A Presenter Own Voice** -> `POST /api/voiceprints/verify` (`VERIFIED`), then record **4B Different Speaker / Impostor** -> `MISMATCH`.
5. **Step 5 — Script Analysis**: Read the scam teleprompter prompt via **Capture Live Speech-to-Text** (or edit transcript directly) and click **Run Live Script Analysis** to view Layer 3 scam categories & quoted risk triggers.
6. **Step 6 — Manipulation**: Stream urgent/coercive phrasing over `WS /api/ws/live-call` to observe live `urgency / secrecy / authority / threat` category counts and pressure score.
7. **Step 7 — Fusion & Action**: Review the 4-layer weighted composite trust equation, EMA smoothing, any voice-clone/liveness override, and execute **Trigger STEP_UP Liveness Challenge**, `PAUSE_BOT`, or `BLOCK` (`POST /api/calls/{id}/action`).
8. **Step 8 — Report & Usage**: Inspect the persisted audit report (`/reports/:id`, analyst `"Was this a scam?"` feedback) and confirm `FRESH` provider rows & credit deduction on `/usage` (plus CSV download via `/api/usage/export.csv`).
