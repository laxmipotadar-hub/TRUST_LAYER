from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
from threading import Lock
from typing import Any

from app.core.config import settings
from app.repositories.json_store import repo


class ResponseCacheService:
    """Disk-backed JSON cache keyed by stable SHA-256 request hashes. Never persists raw audio."""

    def __init__(self) -> None:
        self._lock = Lock()
        self._responses_dir: Path = settings.cache_dir / "responses"
        self._responses_dir.mkdir(parents=True, exist_ok=True)

    def is_enabled(self) -> bool:
        if not settings.cache_enabled:
            return False
        return bool(repo.get_settings_state().get("cache_enabled", True))

    def compute_request_hash(
        self,
        provider: str,
        params: dict[str, Any],
        audio_bytes: bytes | None = None,
        text: str | None = None,
    ) -> str:
        hasher = hashlib.sha256()
        hasher.update(provider.encode("utf-8"))
        hasher.update(json.dumps(params, sort_keys=True).encode("utf-8"))
        if audio_bytes is not None:
            hasher.update(audio_bytes)
        if text is not None:
            hasher.update(text.encode("utf-8"))
        return hasher.hexdigest()

    def get(self, cache_key: str) -> dict[str, Any] | None:
        if not self.is_enabled():
            return None
        target = self._responses_dir / f"{cache_key}.json"
        with self._lock:
            if not target.exists():
                return None
            try:
                data = json.loads(target.read_text(encoding="utf-8"))
                if isinstance(data, dict):
                    data["cache_hit"] = True
                    return data
            except Exception:
                return None
        return None

    def set(self, cache_key: str, provider: str, payload: dict[str, Any]) -> None:
        if not self.is_enabled():
            return
        target = self._responses_dir / f"{cache_key}.json"
        envelope = {
            "cache_key": cache_key,
            "provider": provider,
            "cached_at": datetime.now(timezone.utc).isoformat(),
            "cache_hit": False,
            "payload": payload,
        }
        with self._lock:
            tmp = target.with_suffix(".tmp")
            tmp.write_text(json.dumps(envelope, indent=2), encoding="utf-8")
            tmp.replace(target)

    def stats(self) -> dict[str, Any]:
        with self._lock:
            files = list(self._responses_dir.glob("*.json"))
        return {
            "cache_enabled": self.is_enabled(),
            "cached_entries": len(files),
            "cache_dir": str(self._responses_dir),
        }

    def clear(self) -> int:
        with self._lock:
            files = list(self._responses_dir.glob("*.json"))
            for file in files:
                file.unlink(missing_ok=True)
            return len(files)


cache_service = ResponseCacheService()
