"""OpenRouter 무료 모델 자동 선택 서비스."""

import json
import logging
import time
from typing import Any

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

OPENROUTER_BASE = "https://openrouter.ai/api/v1"
MODELS_URL = f"{OPENROUTER_BASE}/models"

# API 장애·종료 등으로 알려진 모델 (자동 제외)
BLOCKLIST: set[str] = set()

# 무료 모델 조회 실패 시 폴백
FALLBACK_FREE_MODELS = [
    "google/gemma-2-9b-it:free",
    "meta-llama/llama-3.2-3b-instruct:free",
    "microsoft/phi-3-mini-128k-instruct:free",
    "qwen/qwen-2-7b-instruct:free",
    "mistralai/mistral-7b-instruct:free",
]

_cache: dict[str, Any] = {"models": [], "fetched_at": 0.0}
CACHE_TTL = 3600


def _is_free(model: dict) -> bool:
    pricing = model.get("pricing") or {}
    prompt = float(pricing.get("prompt", "1") or "1")
    completion = float(pricing.get("completion", "1") or "1")
    return prompt == 0.0 and completion == 0.0


async def fetch_free_models() -> list[str]:
    now = time.time()
    if _cache["models"] and now - _cache["fetched_at"] < CACHE_TTL:
        return list(_cache["models"])

    models: list[str] = []
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.get(MODELS_URL)
            resp.raise_for_status()
            data = resp.json()
            for m in data.get("data", []):
                mid = m.get("id", "")
                if mid and mid not in BLOCKLIST and _is_free(m):
                    models.append(mid)
    except Exception as e:
        logger.warning("OpenRouter 모델 목록 조회 실패: %s", e)

    if not models:
        models = [m for m in FALLBACK_FREE_MODELS if m not in BLOCKLIST]

    _cache["models"] = models
    _cache["fetched_at"] = now
    return list(models)


def mark_model_failed(model_id: str) -> None:
    BLOCKLIST.add(model_id)
    if model_id in _cache["models"]:
        _cache["models"] = [m for m in _cache["models"] if m != model_id]


async def chat_completion(
    messages: list[dict[str, str]],
    *,
    json_mode: bool = False,
    temperature: float = 0.7,
) -> str:
    if not settings.openrouter_api_key:
        raise ValueError("OPENROUTER_API_KEY가 설정되지 않았습니다.")

    models = await fetch_free_models()
    if not models:
        raise RuntimeError("사용 가능한 무료 OpenRouter 모델이 없습니다.")

    headers = {
        "Authorization": f"Bearer {settings.openrouter_api_key}",
        "HTTP-Referer": settings.openrouter_site_url,
        "X-Title": settings.openrouter_app_name,
        "Content-Type": "application/json",
    }

    last_error: Exception | None = None
    async with httpx.AsyncClient(timeout=120.0) as client:
        for model_id in models:
            body: dict[str, Any] = {
                "model": model_id,
                "messages": messages,
                "temperature": temperature,
            }
            if json_mode:
                body["response_format"] = {"type": "json_object"}

            try:
                resp = await client.post(
                    f"{OPENROUTER_BASE}/chat/completions",
                    headers=headers,
                    json=body,
                )
                if resp.status_code in (404, 429, 502, 503):
                    mark_model_failed(model_id)
                    last_error = RuntimeError(f"{model_id}: HTTP {resp.status_code}")
                    continue
                resp.raise_for_status()
                data = resp.json()
                content = data["choices"][0]["message"]["content"] or ""
                if content.strip():
                    return content
            except httpx.HTTPStatusError as e:
                mark_model_failed(model_id)
                last_error = e
                logger.warning("모델 %s 실패, 다음 모델 시도", model_id)
            except Exception as e:
                mark_model_failed(model_id)
                last_error = e
                logger.warning("모델 %s 오류: %s", model_id, e)

    raise RuntimeError(f"모든 무료 모델 시도 실패: {last_error}")


def parse_json_content(content: str) -> dict[str, Any]:
    text = content.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
    return json.loads(text)
