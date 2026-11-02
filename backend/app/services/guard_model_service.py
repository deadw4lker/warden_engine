"""Qwen3Guard client service (Layer 0 content guard).

Wraps an OpenAI-compatible Qwen3Guard-Gen endpoint (llama.cpp / vLLM / SGLang)
behind a typed verdict, a consecutive-failure circuit breaker, a short-TTL
verdict cache, and a strike counter that escalates repeated instruction-
override attempts to the kill switch.

Failure semantics:
    * guard disabled            -> verdict with safety=None, pipeline skips L0
    * unreachable / malformed   -> safety="ERROR"; caller decides fail-closed
                                   (QWEN_GUARD_FAIL_CLOSED) vs pass-with-flag
Circuit breaker: after QWEN_GUARD_BREAKER_THRESHOLD consecutive failures the
breaker opens; calls fail fast for QWEN_GUARD_BREAKER_COOLDOWN_S, then one
probe call is allowed through.
"""
import hashlib
import os
import re
import time
from collections import OrderedDict
from typing import Any, Dict, List, Optional

import httpx

from app.services.security_service import safe_request, validate_base_url

GEN_LABEL_RE = re.compile(r"Safety:\s*(Safe|Unsafe|Controversial)", re.IGNORECASE)
CATEGORY_RE = re.compile(
    r"(Violent|Non-violent Illegal Acts|Sexual Content or Sexual Acts|PII|"
    r"Suicide & Self-Harm|Unethical Acts|Politically Sensitive Topics|"
    r"Copyright Violation|Jailbreak|None)",
    re.IGNORECASE,
)
REFUSAL_RE = re.compile(r"Refusal:\s*(Yes|No)", re.IGNORECASE)

FREE_TEXT_KEYS = ("user_request", "reason", "task", "text", "message")
MAX_CACHE_ENTRIES = 2048
CACHE_TTL_S = 600.0

_breaker_failures = 0
_breaker_opened_at: Optional[float] = None
_verdict_cache: "OrderedDict[str, tuple[float, Dict[str, Any]]]" = OrderedDict()
_strikes: Dict[str, List[float]] = {}


def _env_bool(name: str, default: str) -> bool:
    return os.getenv(name, default).strip().lower() in ("true", "1", "yes")


def guard_enabled() -> bool:
    return _env_bool("QWEN_GUARD_ENABLED", "false")


def fail_closed() -> bool:
    return _env_bool("QWEN_GUARD_FAIL_CLOSED", "true")


def _max_tokens() -> int:
    return int(os.getenv("QWEN_GUARD_MAX_TOKENS", "64"))


def _endpoint_url() -> Optional[str]:
    url = (os.getenv("QWEN_GUARD_URL", "") or "").strip()
    if not url:
        return None
    return url.rstrip("/") + "/v1/chat/completions"


def _breaker_threshold() -> int:
    return int(os.getenv("QWEN_GUARD_BREAKER_THRESHOLD", "3"))


def _breaker_cooldown_s() -> float:
    return float(os.getenv("QWEN_GUARD_BREAKER_COOLDOWN_S", "30"))


def _strike_threshold() -> int:
    return int(os.getenv("WARDEN_GUARD_STRIKES_THRESHOLD", "2"))


def _strike_window_s() -> float:
    return float(os.getenv("WARDEN_GUARD_STRIKES_WINDOW_S", "300"))


class GuardVerdict(dict):
    """Dict-shaped verdict so it serializes into OPA input / ledger payloads.

    Keys: available, safety (Safe|Controversial|Unsafe|ERROR|None), categories,
    refusal, latency_ms, engine, raw, strike_count.
    """

    @property
    def is_unsafe(self) -> bool:
        return self.get("safety") == "Unsafe"

    @property
    def has_jailbreak(self) -> bool:
        return "jailbreak" in [str(c).lower() for c in (self.get("categories") or [])]


def _verdict(
    safety: Optional[str] = None,
    categories: Optional[List[str]] = None,
    refusal: Optional[bool] = None,
    latency_ms: int = 0,
    raw: str = "",
    engine: str = "qwen3guard",
) -> GuardVerdict:
    return GuardVerdict(
        available=safety is not None,
        safety=safety,
        categories=categories or [],
        refusal=refusal,
        latency_ms=int(latency_ms),
        engine=engine,
        raw=raw[:400],
    )


def _parse_output(text: str, latency_ms: int) -> GuardVerdict:
    label = GEN_LABEL_RE.search(text)
    cats: List[str] = []
    for m in CATEGORY_RE.finditer(text):
        raw_cat = m.group(1)
        if raw_cat.upper() == "PII":
            norm = "PII"
        elif raw_cat.upper() == "NON-VIOLENT ILLEGAL ACTS":
            norm = "Non-violent Illegal Acts"
        elif raw_cat.upper() == "SUIVICIDE & SELF-HARM":
            norm = "Suicide & Self-Harm"
        elif raw_cat.upper() == "SEXUAL CONTENT OR SEXUAL ACTS":
            norm = "Sexual Content or Sexual Acts"
        else:
            norm = raw_cat.title()
        if norm not in cats:
            cats.append(norm)
    refusal_m = REFUSAL_RE.search(text)
    if not label:
        return _verdict("ERROR", [], None, latency_ms, text)
    return _verdict(
        label.group(1).title(),
        cats,
        (refusal_m.group(1).lower() == "yes") if refusal_m else None,
        latency_ms,
        text,
    )


def _cache_key(agent_id: str, messages: List[Dict[str, str]]) -> str:
    joined = agent_id + "|" + "\x00".join(
        f"{m.get('role')}:{m.get('content')}" for m in messages)
    return hashlib.sha256(joined.encode("utf-8")).hexdigest()


def _cache_get(key: str) -> Optional[GuardVerdict]:
    entry = _verdict_cache.get(key)
    if not entry:
        return None
    ts, verdict = entry
    if time.time() - ts > CACHE_TTL_S:
        _verdict_cache.pop(key, None)
        return None
    _verdict_cache.move_to_end(key)
    return verdict


def _cache_put(key: str, verdict: GuardVerdict) -> None:
    _verdict_cache[key] = (time.time(), verdict)
    _verdict_cache.move_to_end(key)
    while len(_verdict_cache) > MAX_CACHE_ENTRIES:
        _verdict_cache.popitem(last=False)


def _breaker_allows_probe() -> bool:
    global _breaker_opened_at
    if _breaker_opened_at is None:
        return True
    if time.time() - _breaker_opened_at >= _breaker_cooldown_s():
        _breaker_opened_at = None
        return True
    return False


def _breaker_record_failure() -> None:
    global _breaker_failures, _breaker_opened_at
    _breaker_failures += 1
    if _breaker_failures >= _breaker_threshold():
        _breaker_opened_at = time.time()
        _breaker_failures = 0


def _breaker_record_success() -> None:
    global _breaker_failures, _breaker_opened_at
    _breaker_failures = 0
    _breaker_opened_at = None


def breaker_status() -> Dict[str, Any]:
    return {"failures": _breaker_failures,
            "open": _breaker_opened_at is not None,
            "cooldown_s": _breaker_cooldown_s()}


async def classify(agent_id: Optional[str], messages: List[Dict[str, str]]) -> GuardVerdict:
    """Classify a message list through the Qwen3Guard endpoint."""
    key = _cache_key(agent_id or "", messages)
    cached = _cache_get(key)
    if cached is not None:
        return GuardVerdict(cached)

    if not _breaker_allows_probe():
        return _verdict("ERROR", [], None, 0, "guard circuit breaker open")

    url = _endpoint_url()
    if not url:
        return _verdict("ERROR", [], None, 0, "guard endpoint not configured")

    try:
        base_url = validate_base_url(url.split("/v1/")[0] + "/v1",
                                     allow_local=True)
        url = base_url + "/chat/completions"
    except ValueError as ve:
        return _verdict("ERROR", [], None, 0, f"guard URL invalid: {ve}")

    payload = {
        "model": os.getenv("QWEN_GUARD_MODEL", "guard"),
        "messages": messages,
        "max_tokens": _max_tokens(),
        "temperature": 0,
    }
    started = time.perf_counter()
    try:
        async with httpx.AsyncClient(
                timeout=float(os.getenv("QWEN_GUARD_TIMEOUT_SECONDS", "10"))) as client:
            resp = await safe_request(client, "POST", url, json=payload,
                                      headers={"Content-Type": "application/json"})
        if resp.status_code != 200:
            raise RuntimeError(f"guard HTTP {resp.status_code}")
        content = resp.json()["choices"][0]["message"]["content"]
        verdict = _parse_output(content or "",
                                int((time.perf_counter() - started) * 1000))
        _breaker_record_success()
        if verdict.get("safety") != "ERROR":
            _cache_put(key, verdict)
        return verdict
    except Exception as exc:
        _breaker_record_failure()
        return _verdict("ERROR", [], None,
                        int((time.perf_counter() - started) * 1000),
                        f"guard error: {exc}")


def build_prompt_messages(text: str) -> List[Dict[str, str]]:
    return [{"role": "user", "content": text}]


def build_response_messages(user_text: str, response_text: str) -> List[Dict[str, str]]:
    return [
        {"role": "user", "content": user_text},
        {"role": "assistant", "content": response_text},
    ]


async def run_prompt_guard(agent_id: Optional[str], text: str) -> GuardVerdict:
    trimmed = (text or "").strip()
    if len(trimmed) > 20000:
        trimmed = trimmed[:20000]
    return await classify(agent_id, build_prompt_messages(trimmed))


async def run_response_guard(agent_id: Optional[str], user_text: str,
                             response_text: str, system_text: str = "") -> GuardVerdict:
    assistant_cut = (response_text or "").strip()[:8000]
    if not assistant_cut:
        return _verdict("Safe", [], None, 0, "empty response")
    user_cut = (user_text or "").strip()[:4000]
    system_part = (system_text or "").strip()[:1000]
    if system_part:
        user_cut = f"[system policy context: {system_part}]\n{user_cut}"
    return await classify(agent_id, build_response_messages(user_cut, assistant_cut))


def guard_text_from_params(params: Optional[Dict[str, Any]], action: str = "") -> str:
    """Concatenate the free-text surfaces an agent speaks with, for L0 input.

    Returns "" when the proposal only carries structured fields (ids,
    amounts) with no natural language worth moderating — cheaper L0 skip.
    """
    p = params or {}
    text_parts: List[str] = []
    for k in FREE_TEXT_KEYS:
        v = p.get(k)
        if isinstance(v, str) and v.strip():
            text_parts.append(v.strip())
    if not text_parts:
        return ""
    parts = ([str(action)] if action else []) + text_parts
    return " | ".join(parts)[:20000]


def opa_guard_snapshot(verdict: "GuardVerdict | Dict[str, Any] | None") -> Dict[str, Any]:
    """Shape consumed by policies/*.rego via input.guard."""
    if verdict is None:
        v: Dict[str, Any] = {}
    elif isinstance(verdict, GuardVerdict):
        v = dict(verdict)
    else:
        v = dict(verdict)
    cats = [str(c) for c in (v.get("categories") or [])]
    return {
        "safety": (str(v.get("safety") or "").lower() or "unknown"),
        "jailbreak": any(c.lower() == "jailbreak" for c in cats),
        "categories": cats,
        "engine": str(v.get("engine") or "unknown"),
        "available": bool(v.get("available")),
    }


def record_override_strike(agent_id: str) -> Dict[str, Any]:
    """Track instruction-override attempts; escalation at strike threshold."""
    now = time.time()
    window = _strike_window_s()
    key = agent_id or "?"
    hits = [ts for ts in _strikes.get(key, []) if now - ts < window]
    hits.append(now)
    _strikes[key] = hits
    return {"strike_count": len(hits), "threshold": _strike_threshold(),
            "window_s": int(window), "escalate": len(hits) >= _strike_threshold()}


def reset_strikes(agent_id: str) -> None:
    _strikes.pop(agent_id or "?", None)


def compose_verdict_list(verdict: GuardVerdict) -> str:
    cats = ", ".join(verdict.get("categories") or []) or "None"
    return f"safety={verdict.get('safety')} categories=[{cats}]"
