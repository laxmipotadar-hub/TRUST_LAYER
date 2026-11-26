from __future__ import annotations

import json
from pathlib import Path
from threading import Lock
from typing import Any

from app.core.config import settings
from app.schemas import (
    AppMode,
    CallActionRecord,
    CallFeedbackRecord,
    CallSession,
    ChallengeSession,
    ThreatRegistryEntry,
    VoiceprintRecord,
)
from app.schemas.common import DEFAULT_LAYER_WEIGHTS


SEEDED_VOICEPRINTS = [
    VoiceprintRecord(
        voiceprint_id="VP-4821-MV",
        customer_id="CUST-4821-MARCUS",
        customer_name="Marcus Vance",
        account_tier="Private Wealth",
        enrollment_purpose="High-value wire & travel-notice voice authentication",
        consent_confirmed=True,
        consent_timestamp="2026-10-14T09:29:15Z",
        enrolled_at="2026-10-14T09:30:00Z",
        sample_duration_sec=14.2,
        enrollment_source="CACHED ANALYSIS",
        provider_speaker_ref="eidos-ref-marcus-4821",
        last_verified_at="2026-11-24T10:12:00Z",
        last_verification_status="VERIFIED",
        last_match_percentage=94.0,
        verification_count=3,
        mismatch_count=0,
        status="ACTIVE",
    ),
    VoiceprintRecord(
        voiceprint_id="VP-9042-ER",
        customer_id="CUST-9042-ELENA",
        customer_name="Elena Rostova",
        account_tier="Commercial Treasury",
        enrollment_purpose="Treasury disbursement & account-recovery voice authentication",
        consent_confirmed=True,
        consent_timestamp="2026-10-21T14:14:00Z",
        enrolled_at="2026-10-21T14:15:00Z",
        sample_duration_sec=11.8,
        enrollment_source="CACHED ANALYSIS",
        provider_speaker_ref="eidos-ref-elena-9042",
        last_verified_at="2026-11-23T16:40:00Z",
        last_verification_status="MISMATCH",
        last_match_percentage=8.0,
        verification_count=2,
        mismatch_count=1,
        status="ACTIVE",
    ),
]

SEEDED_THREAT_REGISTRY = [
    ThreatRegistryEntry(
        entry_id="TH-2026-001",
        pattern_name="Central Bank Safe-Account Coercion",
        anonymous_speaker_ref="anon-spk-84c2a19e04",
        category="Authorized Push Payment Scam",
        severity="CRITICAL",
        detection_date="2026-11-24T18:20:00Z",
        evidence_reference="Fixture S4 · OTP + AnyDesk + Safe-Account",
        verification_status="CONFIRMED THREAT",
        institution_scope="Seeded Demonstration Fixture (Single-Node)",
        indicators=["safe account", "central bank compliance", "do not hang up", "OTP"],
        reported_institutions=1,
        last_seen="2026-11-24T18:20:00Z",
        provenance="CACHED ANALYSIS",
    ),
    ThreatRegistryEntry(
        entry_id="TH-2026-002",
        pattern_name="Executive Keynote Neural Voice Clone",
        anonymous_speaker_ref="anon-spk-31b7d40f12",
        category="AI Voice Synthesis",
        severity="CRITICAL",
        detection_date="2026-11-23T11:05:00Z",
        evidence_reference="Fixture S2 · Aletheia Vocoder Discontinuity",
        verification_status="CONFIRMED THREAT",
        institution_scope="Seeded Demonstration Fixture (Single-Node)",
        indicators=["vocoder phase smoothing 4.5-7.8kHz", "jitter < 0.2%", "manual exception"],
        reported_institutions=1,
        last_seen="2026-11-23T11:05:00Z",
        provenance="CACHED ANALYSIS",
    ),
    ThreatRegistryEntry(
        entry_id="TH-2026-003",
        pattern_name="Dual-Reverb Stitched Audio Replay",
        anonymous_speaker_ref="anon-spk-67e9032a5b",
        category="Replay Attack",
        severity="HIGH",
        detection_date="2026-11-22T15:40:00Z",
        evidence_reference="Fixture S3 · Challenge Liveness Failed",
        verification_status="CONFIRMED THREAT",
        institution_scope="Seeded Demonstration Fixture (Single-Node)",
        indicators=["comb-filtering notches", "replay echo correlation > 0.75", "static phrase response"],
        reported_institutions=1,
        last_seen="2026-11-22T15:40:00Z",
        provenance="CACHED ANALYSIS",
    ),
]


class AegisRepository:
    """Thread-safe JSON-backed repository storing runtime state in /data."""

    def __init__(self) -> None:
        self._lock = Lock()
        self._calls_path = settings.cache_dir / "calls.json"
        self._state_path = settings.cache_dir / "settings.json"
        self._voiceprints_path = settings.cache_dir / "voiceprints.json"
        self._challenges_path = settings.cache_dir / "challenges.json"
        self._registry_path = settings.cache_dir / "threat_registry.json"

        self._ensure_file(self._calls_path, [])
        self._ensure_file(
            self._state_path,
            {
                "app_mode": settings.app_mode,
                "cache_enabled": settings.cache_enabled,
                "bot_guard_enabled": True,
                "bot_guard_threshold": 40,
            },
        )
        self._ensure_file(
            self._voiceprints_path,
            [vp.model_dump() for vp in SEEDED_VOICEPRINTS],
        )
        self._ensure_file(self._challenges_path, [])
        self._ensure_file(
            self._registry_path,
            [entry.model_dump() for entry in SEEDED_THREAT_REGISTRY],
        )

    def _ensure_file(self, path: Path, default: Any) -> None:
        if not path.exists():
            self._write(path, default)

    def _read(self, path: Path) -> Any:
        return json.loads(path.read_text(encoding="utf-8"))

    def _write(self, path: Path, payload: Any) -> None:
        tmp = path.with_suffix(".tmp")
        tmp.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        tmp.replace(path)

    # --- Settings ---
    def get_settings_state(self) -> dict[str, Any]:
        with self._lock:
            raw = self._read(self._state_path)
            weights = raw.get("layer_weights") or {}
            merged_weights = {
                key: float(weights.get(key, default_val))
                for key, default_val in DEFAULT_LAYER_WEIGHTS.items()
            }
            return {
                "app_mode": "REAL" if raw.get("app_mode") == "REAL" else "DEMO",
                "cache_enabled": bool(raw.get("cache_enabled", True)),
                "bot_guard_enabled": bool(raw.get("bot_guard_enabled", True)),
                "bot_guard_threshold": int(raw.get("bot_guard_threshold", 40)),
                "layer_weights": merged_weights,
                "safe_threshold": float(raw.get("safe_threshold", 75.0)),
                "review_threshold": float(raw.get("review_threshold", 40.0)),
                "ema_alpha": float(raw.get("ema_alpha", 0.45)),
                "language": str(raw.get("language", "en")),
            }

    def update_settings_state(
        self,
        app_mode: AppMode | None = None,
        cache_enabled: bool | None = None,
        bot_guard_enabled: bool | None = None,
        bot_guard_threshold: int | None = None,
        layer_weights: dict[str, float] | None = None,
        safe_threshold: float | None = None,
        review_threshold: float | None = None,
        ema_alpha: float | None = None,
        language: str | None = None,
    ) -> dict[str, Any]:
        with self._lock:
            current = self._read(self._state_path)
            if app_mode is not None:
                current["app_mode"] = app_mode
            if cache_enabled is not None:
                current["cache_enabled"] = cache_enabled
            if bot_guard_enabled is not None:
                current["bot_guard_enabled"] = bot_guard_enabled
            if bot_guard_threshold is not None:
                current["bot_guard_threshold"] = bot_guard_threshold
            if layer_weights is not None:
                current["layer_weights"] = layer_weights
            if safe_threshold is not None:
                current["safe_threshold"] = safe_threshold
            if review_threshold is not None:
                current["review_threshold"] = review_threshold
            if ema_alpha is not None:
                current["ema_alpha"] = ema_alpha
            if language is not None:
                current["language"] = language
            self._write(self._state_path, current)
            return current

    # --- Calls ---
    def save_call(self, call: CallSession) -> CallSession:
        with self._lock:
            items: list[dict[str, Any]] = self._read(self._calls_path)
            items.append(call.model_dump())
            if len(items) > 100:
                items = items[-100:]
            self._write(self._calls_path, items)
            return call

    def update_call(self, call: CallSession) -> CallSession:
        with self._lock:
            items: list[dict[str, Any]] = self._read(self._calls_path)
            for idx, item in enumerate(items):
                if item.get("call_id") == call.call_id:
                    items[idx] = call.model_dump()
                    self._write(self._calls_path, items)
                    return call
            items.append(call.model_dump())
            self._write(self._calls_path, items[-100:])
            return call

    def get_current_call(self) -> CallSession | None:
        with self._lock:
            items: list[dict[str, Any]] = self._read(self._calls_path)
            if not items:
                return None
            return CallSession(**items[-1])

    def get_call(self, call_id: str) -> CallSession | None:
        with self._lock:
            items: list[dict[str, Any]] = self._read(self._calls_path)
            for item in reversed(items):
                if item.get("call_id") == call_id:
                    return CallSession(**item)
            return None

    def list_calls(self, limit: int = 25) -> list[CallSession]:
        with self._lock:
            items: list[dict[str, Any]] = self._read(self._calls_path)
            return [CallSession(**item) for item in reversed(items[-limit:])]

    def count_calls(self) -> int:
        with self._lock:
            return len(self._read(self._calls_path))

    def append_call_action(self, call_id: str, action: CallActionRecord) -> CallSession | None:
        with self._lock:
            items: list[dict[str, Any]] = self._read(self._calls_path)
            for item in items:
                if item.get("call_id") == call_id:
                    actions = item.setdefault("actions_taken", [])
                    actions.append(action.model_dump())

                    timeline = item.setdefault("evidence_timeline", [])
                    is_takeover = action.action == "TRANSFER_TO_HUMAN"
                    is_block = action.action in ("BLOCK_CALL", "FREEZE_ACCOUNT", "TERMINATE_CALL")
                    if is_block:
                        item["call_state"] = "VERDICT"
                        item["decision"] = "END_CALL"
                        item["verdict"] = "THREAT"
                        item["band"] = "THREAT"
                        item["decision_reason"] = action.operator_note or "Call ended by operator."
                    elif action.action == "ALLOW" and item.get("voice_authenticity", {}).get("verdict") != "fake":
                        item["call_state"] = "VERDICT"
                        item["decision"] = "ALLOW"
                        item["verdict"] = "SAFE"
                        item["band"] = "SAFE"
                        item["decision_reason"] = action.operator_note or "Call approved by operator."
                    elif action.action in ("CHALLENGE", "STEP_UP_CHALLENGE"):
                        item["call_state"] = "CHALLENGE"
                        item["decision"] = "STEP_UP"
                        item["verdict"] = "CAUTION"
                        item["band"] = "REVIEW"
                    elif is_takeover:
                        item["call_state"] = "VERDICT"
                        item["decision_reason"] = action.operator_note or "Transferred to human specialist."
                    timeline.append(
                        {
                            "id": f"ev-act-{len(actions)}",
                            "timestamp_sec": 14.0 + len(actions) * 0.5,
                            "category": "POLICY",
                            "severity": "CRITICAL" if is_block else ("WARNING" if is_takeover or action.action == "PAUSE_BOT" else "INFO"),
                            "title": (
                                "HUMAN TAKEOVER: TRANSFERRED TO HUMAN"
                                if is_takeover
                                else f"Operator Action: {action.action}"
                            ),
                            "description": action.operator_note
                            or (
                                "Automated bot speech halted; call transferred to human banking specialist."
                                if is_takeover
                                else f"SOC operator executed {action.action}."
                            ),
                            "provenance": item.get("overall_provenance", "CACHED ANALYSIS"),
                        }
                    )

                    self._write(self._calls_path, items)
                    return CallSession(**item)
            return None

    def set_call_feedback(self, call_id: str, feedback: CallFeedbackRecord) -> CallSession | None:
        with self._lock:
            items: list[dict[str, Any]] = self._read(self._calls_path)
            for item in items:
                if item.get("call_id") == call_id:
                    item["feedback"] = feedback.model_dump()
                    self._write(self._calls_path, items)
                    return CallSession(**item)
            return None

    # --- Reports ---
    def save_report(self, report_id: str, payload: dict[str, Any]) -> None:
        with self._lock:
            self._write(settings.reports_dir / f"{report_id}.json", payload)

    def list_reports(self, limit: int = 30) -> list[dict[str, Any]]:
        with self._lock:
            files = sorted(
                [p for p in settings.reports_dir.glob("RPT-*.json")],
                key=lambda p: p.stat().st_mtime,
                reverse=True,
            )[:limit]
            out: list[dict[str, Any]] = []
            for p in files:
                try:
                    out.append(json.loads(p.read_text(encoding="utf-8")))
                except Exception:
                    continue
            return out

    # --- Voiceprints ---
    def list_voiceprints(self) -> list[VoiceprintRecord]:
        with self._lock:
            items: list[dict[str, Any]] = self._read(self._voiceprints_path)
            records: list[VoiceprintRecord] = []
            for item in items:
                vp = VoiceprintRecord(**item)
                ref = (vp.provider_speaker_ref or "").strip()
                if not vp.provider_speaker_id and ref and not ref.startswith(("sim-", "eidos-ref-")):
                    vp = vp.model_copy(update={"provider_speaker_id": ref})
                records.append(vp)
            return records

    @staticmethod
    def _is_live_voiceprint_dict(item: dict[str, Any]) -> bool:
        if item.get("status", "ACTIVE") != "ACTIVE":
            return False
        pid = str(item.get("provider_speaker_id") or item.get("provider_speaker_ref") or "").strip()
        return bool(pid) and not pid.startswith(("sim-", "eidos-ref-"))

    def get_voiceprint_by_customer(self, customer_id: str) -> VoiceprintRecord | None:
        with self._lock:
            items: list[dict[str, Any]] = self._read(self._voiceprints_path)
            active_matches = [
                item
                for item in items
                if item.get("customer_id") == customer_id and item.get("status", "ACTIVE") == "ACTIVE"
            ]
            if not active_matches:
                return None
            # Prefer newest LIVE voiceprint (has valid non-placeholder provider_speaker_id / ref),
            # ranking explicit REAL ANALYSIS highest if multiple live entries exist.
            live_matches = [item for item in active_matches if self._is_live_voiceprint_dict(item)]
            real_live_matches = [
                item
                for item in live_matches
                if str(item.get("enrollment_source") or "").strip().upper() == "REAL ANALYSIS"
            ]
            chosen = (
                real_live_matches[-1]
                if real_live_matches
                else (live_matches[-1] if live_matches else active_matches[-1])
            )
            vp = VoiceprintRecord(**chosen)
            ref = (vp.provider_speaker_ref or "").strip()
            if not vp.provider_speaker_id and ref and not ref.startswith(("sim-", "eidos-ref-")):
                vp = vp.model_copy(update={"provider_speaker_id": ref})
            return vp

    def add_voiceprint(self, record: VoiceprintRecord) -> VoiceprintRecord:
        with self._lock:
            items: list[dict[str, Any]] = self._read(self._voiceprints_path)
            candidate_pid = str(record.provider_speaker_id or record.provider_speaker_ref or "").strip()
            is_new_live = (
                record.status == "ACTIVE"
                and bool(candidate_pid)
                and not candidate_pid.startswith(("sim-", "eidos-ref-"))
            )
            if is_new_live:
                # Replace stale SIMULATION or prior ACTIVE duplicates for the same customer_id
                cleaned: list[dict[str, Any]] = []
                carried_history: list[dict[str, Any]] = [h.model_dump() for h in record.verification_history]
                for item in items:
                    if item.get("customer_id") == record.customer_id and item.get("status", "ACTIVE") == "ACTIVE":
                        if not carried_history and item.get("verification_history"):
                            carried_history = list(item.get("verification_history") or [])
                        continue
                    cleaned.append(item)
                items = cleaned
                if carried_history and not record.verification_history:
                    record = VoiceprintRecord(**{**record.model_dump(), "verification_history": carried_history})
            items.append(record.model_dump())
            self._write(self._voiceprints_path, items)
            return record

    def record_voiceprint_verification(
        self,
        customer_id: str,
        entry_dict: dict[str, Any],
    ) -> VoiceprintRecord | None:
        with self._lock:
            items: list[dict[str, Any]] = self._read(self._voiceprints_path)
            for item in items:
                if item.get("customer_id") == customer_id and item.get("status", "ACTIVE") == "ACTIVE":
                    history = item.setdefault("verification_history", [])
                    history.insert(0, entry_dict)
                    item["verification_history"] = history[:25]
                    item["last_verified_at"] = entry_dict.get("verified_at")
                    item["last_verification_status"] = entry_dict.get("result", "UNVERIFIED")
                    item["last_match_percentage"] = entry_dict.get("match_percentage")
                    item["verification_count"] = int(item.get("verification_count", 0)) + 1
                    if entry_dict.get("result") == "MISMATCH":
                        item["mismatch_count"] = int(item.get("mismatch_count", 0)) + 1
                    self._write(self._voiceprints_path, items)
                    return VoiceprintRecord(**item)
            return None

    def revoke_voiceprint(self, voiceprint_id: str, revoked_at: str) -> VoiceprintRecord | None:
        with self._lock:
            items: list[dict[str, Any]] = self._read(self._voiceprints_path)
            for item in items:
                if item.get("voiceprint_id") == voiceprint_id:
                    item["status"] = "REVOKED"
                    item["revoked_at"] = revoked_at
                    self._write(self._voiceprints_path, items)
                    return VoiceprintRecord(**item)
            return None

    def delete_voiceprint(self, voiceprint_id: str) -> bool:
        with self._lock:
            items: list[dict[str, Any]] = self._read(self._voiceprints_path)
            filtered = [item for item in items if item.get("voiceprint_id") != voiceprint_id]
            if len(filtered) == len(items):
                return False
            self._write(self._voiceprints_path, filtered)
            return True

    # --- Challenges ---
    def save_challenge(self, challenge: ChallengeSession) -> ChallengeSession:
        with self._lock:
            items: list[dict[str, Any]] = self._read(self._challenges_path)
            items.append(challenge.model_dump())
            self._write(self._challenges_path, items[-100:])
            return challenge

    def get_challenge(self, challenge_id: str) -> ChallengeSession | None:
        with self._lock:
            items: list[dict[str, Any]] = self._read(self._challenges_path)
            for item in reversed(items):
                if item.get("challenge_id") == challenge_id:
                    return ChallengeSession(**item)
            return None

    def update_challenge_status(self, challenge_id: str, status: str) -> None:
        with self._lock:
            items: list[dict[str, Any]] = self._read(self._challenges_path)
            for item in items:
                if item.get("challenge_id") == challenge_id:
                    item["status"] = status
                    self._write(self._challenges_path, items)
                    return

    # --- Threat Registry ---
    def list_threat_registry(self) -> list[ThreatRegistryEntry]:
        with self._lock:
            items: list[dict[str, Any]] = self._read(self._registry_path)
            return [ThreatRegistryEntry(**item) for item in items]

    def add_threat_entry(self, entry: ThreatRegistryEntry) -> ThreatRegistryEntry:
        with self._lock:
            items: list[dict[str, Any]] = self._read(self._registry_path)
            items.insert(0, entry.model_dump())
            self._write(self._registry_path, items[:200])
            return entry

    def update_threat_status(self, entry_id: str, status: str) -> ThreatRegistryEntry | None:
        with self._lock:
            items: list[dict[str, Any]] = self._read(self._registry_path)
            for item in items:
                if item.get("entry_id") == entry_id:
                    item["verification_status"] = status
                    self._write(self._registry_path, items)
                    return ThreatRegistryEntry(**item)
            return None


repo = AegisRepository()
