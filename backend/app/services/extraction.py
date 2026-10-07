"""Specialty extraction: free referral text -> a trustworthy specialty_id, or a
clean abstention. The model PROPOSES; deterministic code DISPOSES.

Three layers keep 'extract' from sliding into 'infer':
  1. Structured Outputs (strict JSON schema) forces the answer shape.
  2. enum-or-null: specialty_id must be one of the DB allowlist ids, or null.
  3. An exact-span validator: the model's evidence_quote must appear verbatim in
     the letter. If it doesn't, we reject and hand it to the GP.

Any abstention/failure returns source='none' (GP selects manually). A validated
hit returns source='model'. We NEVER return a guessed specialty.
"""
import json
import re

import httpx

from app.core.config import settings
from app.db import store
from app.models.schemas import ExtractResult

_MODEL_INPUT_CAP = 16000   # referrals are short; bounds the one model call
_TIMEOUT = 30.0


def _norm(s: str) -> str:
    """Collapse whitespace + casefold, so the span check tolerates PDF spacing
    and capitalisation without accepting invented text."""
    return re.sub(r"\s+", " ", s or "").strip().casefold()


def quote_in_text(quote: str, text: str) -> bool:
    q = _norm(quote)
    return bool(q) and q in _norm(text)


def _abstain(detail: str) -> ExtractResult:
    return ExtractResult(specialty_id=None, display_name=None,
                         evidence_quote=None, source="none", detail=detail)


async def extract_specialty(text: str) -> ExtractResult:
    specs = await store.list_specialties()
    display = {s["specialty_id"]: s["display_name"] for s in specs}
    ids = list(display.keys())

    if not settings.openai_api_key:
        return _abstain("Extraction isn't configured — select the specialty manually.")

    reference = "\n".join(
        f"- {s['specialty_id']} ({s['display_name']})"
        + (f"; also written: {s['aliases']}" if s.get("aliases") else "")
        for s in specs
    )
    system = (
        "You identify the ONE medical specialty a GP referral letter EXPLICITLY names "
        "as the referral destination (e.g. 'refer to Orthopaedics', 'Dermatology clinic').\n"
        "Rules:\n"
        "- Choose specialty_id ONLY from this approved list:\n" + reference + "\n"
        "- If the letter does NOT explicitly name a specialty from the list, set "
        "specialty_id = null. Do not guess.\n"
        "- NEVER infer a specialty from symptoms, diagnosis, medication or history — "
        "only an explicitly written specialty or department counts.\n"
        "- evidence_quote must be copied VERBATIM from the letter (the exact words that "
        "name the specialty). If specialty_id is null, evidence_quote must be null."
    )
    schema = {
        "type": "object",
        "additionalProperties": False,
        "required": ["specialty_id", "evidence_quote"],
        "properties": {
            "specialty_id": {"type": ["string", "null"], "enum": ids + [None]},
            "evidence_quote": {"type": ["string", "null"]},
        },
    }
    body = {
        "model": settings.openai_model,
        "temperature": 0,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": text[:_MODEL_INPUT_CAP]},
        ],
        "response_format": {
            "type": "json_schema",
            "json_schema": {"name": "specialty_extraction", "strict": True, "schema": schema},
        },
    }
    url = settings.openai_base_url.rstrip("/") + "/chat/completions"
    headers = {"Authorization": f"Bearer {settings.openai_api_key}"}

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as c:
            r = await c.post(url, json=body, headers=headers)
            r.raise_for_status()
            msg = r.json()["choices"][0]["message"]
    except (httpx.HTTPError, KeyError, IndexError):
        return _abstain("Extraction failed — select the specialty manually.")

    if msg.get("refusal"):
        return _abstain("Extraction declined — select the specialty manually.")

    try:
        parsed = json.loads(msg.get("content") or "{}")
    except json.JSONDecodeError:
        return _abstain("Extraction returned an unreadable result — select manually.")

    sid = parsed.get("specialty_id")
    quote = parsed.get("evidence_quote")

    if sid is None:
        return _abstain("No specialty explicitly stated — select it manually.")
    if sid not in display:                                  # off-list defence
        return _abstain("Extracted value isn't on the approved list — select manually.")
    if not quote or not quote_in_text(quote, text):         # anti-hallucination span check
        return _abstain("Couldn't verify the specialty against the letter — select manually.")

    return ExtractResult(specialty_id=sid, display_name=display[sid],
                         evidence_quote=quote, source="model",
                         detail=f'Stated in the letter as "{quote}".')