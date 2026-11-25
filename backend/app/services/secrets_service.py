from __future__ import annotations

import json
import os
from threading import Lock
from typing import Any

from app.core.config import settings
from app.schemas.common import SecretsStatusResponse


_LOCK = Lock()
_SECRETS_PATH = settings.data_dir / "secrets.local.json"


def _mask_hint(val: str) -> str:
    clean = val.strip()
    if not clean:
        return "NOT SET"
    if len(clean) <= 8:
        return "SET (****)"
    return f"SET ({clean[:4]}...{clean[-4:]})"


def load_persisted_secrets() -> None:
    """Apply server-only persisted keys to runtime settings without writing keys to client files."""
    if not _SECRETS_PATH.exists():
        return
    try:
        data = json.loads(_SECRETS_PATH.read_text(encoding="utf-8"))
        if isinstance(data, dict):
            if data.get("detectif_api_key"):
                settings.detectif_api_key = str(data["detectif_api_key"]).strip()
            if data.get("groq_api_key"):
                settings.groq_api_key = str(data["groq_api_key"]).strip()
            if data.get("detectif_api_base_url"):
                settings.detectif_api_base_url = str(data["detectif_api_base_url"]).strip()
            if data.get("groq_stt_model"):
                settings.groq_stt_model = str(data["groq_stt_model"]).strip()
            if data.get("groq_llm_model"):
                settings.groq_llm_model = str(data["groq_llm_model"]).strip()
    except Exception:
        pass


def get_secrets_status() -> SecretsStatusResponse:
    return SecretsStatusResponse(
        detectifai_configured=settings.detectifai_configured,
        groq_configured=settings.groq_configured,
        detectif_key_hint=_mask_hint(settings.detectif_api_key),
        groq_key_hint=_mask_hint(settings.groq_api_key),
        detectifai_base_url=settings.detectif_api_base_url,
        groq_stt_model=settings.groq_stt_model,
        groq_llm_model=settings.groq_llm_model,
    )


def update_server_secrets(
    *,
    detectif_api_key: str | None = None,
    groq_api_key: str | None = None,
    detectif_api_base_url: str | None = None,
    groq_stt_model: str | None = None,
    groq_llm_model: str | None = None,
) -> SecretsStatusResponse:
    """Persist API keys server-side only (0600 file permissions) and refresh live Settings."""
    with _LOCK:
        existing: dict[str, Any] = {}
        if _SECRETS_PATH.exists():
            try:
                loaded = json.loads(_SECRETS_PATH.read_text(encoding="utf-8"))
                if isinstance(loaded, dict):
                    existing = loaded
            except Exception:
                existing = {}

        if detectif_api_key is not None:
            clean = detectif_api_key.strip()
            settings.detectif_api_key = clean
            existing["detectif_api_key"] = clean
        if groq_api_key is not None:
            clean = groq_api_key.strip()
            settings.groq_api_key = clean
            existing["groq_api_key"] = clean
        if detectif_api_base_url is not None and detectif_api_base_url.strip():
            clean_url = detectif_api_base_url.strip()
            settings.detectif_api_base_url = clean_url
            existing["detectif_api_base_url"] = clean_url
        if groq_stt_model is not None and groq_stt_model.strip():
            clean_stt = groq_stt_model.strip()
            settings.groq_stt_model = clean_stt
            existing["groq_stt_model"] = clean_stt
        if groq_llm_model is not None and groq_llm_model.strip():
            clean_llm = groq_llm_model.strip()
            settings.groq_llm_model = clean_llm
            existing["groq_llm_model"] = clean_llm

        _SECRETS_PATH.parent.mkdir(parents=True, exist_ok=True)
        tmp = _SECRETS_PATH.with_suffix(".tmp")
        tmp.write_text(json.dumps(existing, indent=2), encoding="utf-8")
        os.chmod(tmp, 0o600)
        tmp.replace(_SECRETS_PATH)
        os.chmod(_SECRETS_PATH, 0o600)
    return get_secrets_status()


def clear_server_secrets() -> SecretsStatusResponse:
    with _LOCK:
        settings.detectif_api_key = ""
        settings.groq_api_key = ""
        if _SECRETS_PATH.exists():
            _SECRETS_PATH.unlink()
    return get_secrets_status()


load_persisted_secrets()
