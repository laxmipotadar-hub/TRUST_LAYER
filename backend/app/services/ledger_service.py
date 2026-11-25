from __future__ import annotations

from datetime import datetime, timezone
import json
from threading import Lock
from typing import Literal

from app.core.config import settings
from app.schemas.usage import LedgerMode, OperationLedgerEntry


_LOCK = Lock()


def _ledger_path():
    return settings.cache_dir / "operations_ledger.json"


_ALLOWED_SERVICES = {"aletheia", "eidos", "groq", "enroll", "challenge", "pipeline"}


def read_ledger(limit: int = 200) -> list[OperationLedgerEntry]:
    path = _ledger_path()
    if not path.exists():
        return []
    with _LOCK:
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
            if not isinstance(raw, list):
                return []
            entries: list[OperationLedgerEntry] = []
            for row in raw[:limit]:
                if isinstance(row, dict):
                    fixed = dict(row)
                    if fixed.get("service") not in _ALLOWED_SERVICES:
                        fixed["service"] = "groq"
                    entries.append(OperationLedgerEntry(**fixed))
            return entries
        except Exception:
            return []


def record_operation(
    *,
    operation_id: str,
    call_id: str,
    service: Literal["aletheia", "eidos", "groq", "enroll", "challenge", "pipeline"],
    endpoint: str,
    mode: LedgerMode,
    status: str = "done",
    cost_credits: float = 0.0,
    latency_ms: float = 0.0,
    cached: bool = False,
) -> OperationLedgerEntry:
    entry = OperationLedgerEntry(
        operation_id=operation_id,
        call_id=call_id,
        service=service,
        endpoint=endpoint,
        mode=mode,
        status=status,
        cost_credits=round(float(max(0.0, cost_credits)), 4),
        latency_ms=round(float(max(0.0, latency_ms)), 2),
        timestamp=datetime.now(timezone.utc).isoformat(),
        cached=cached,
    )
    path = _ledger_path()
    with _LOCK:
        existing: list[dict] = []
        if path.exists():
            try:
                loaded = json.loads(path.read_text(encoding="utf-8"))
                if isinstance(loaded, list):
                    existing = loaded
            except Exception:
                existing = []
        existing.insert(0, entry.model_dump())
        tmp = path.with_suffix(".tmp")
        tmp.write_text(json.dumps(existing[:500], indent=2), encoding="utf-8")
        tmp.replace(path)
    return entry


def clear_ledger() -> None:
    path = _ledger_path()
    with _LOCK:
        if path.exists():
            path.unlink()
