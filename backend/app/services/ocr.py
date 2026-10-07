"""OCR fallback via Mistral Document AI (hosted, EU). Used ONLY when a PDF has no
text layer, or when an image is uploaded. It turns the document into text, which
then runs through the SAME extraction + verbatim-span validator as a typed
referral — so the 'extract, never infer' guarantees are unchanged.

Synthetic data only at this stage: the document image goes to Mistral (EU), the
same posture as the one OpenAI extraction call.
"""
import base64
import mimetypes

import httpx

from app.core.config import settings

_TIMEOUT = 60.0


class OcrError(RuntimeError):
    """OCR couldn't produce text (unconfigured, unreachable, or empty result)."""


def enabled() -> bool:
    return bool(settings.mistral_api_key)


def _document(filename: str, data: bytes) -> dict:
    """Build Mistral's `document` payload from bytes, as a base64 data URI."""
    b64 = base64.b64encode(data).decode("ascii")
    if filename.lower().endswith(".pdf"):
        return {"type": "document_url",
                "document_url": f"data:application/pdf;base64,{b64}"}
    mime = mimetypes.guess_type(filename)[0] or "image/png"
    return {"type": "image_url", "image_url": f"data:{mime};base64,{b64}"}


async def ocr_document(filename: str, data: bytes) -> str:
    if not enabled():
        raise OcrError("OCR isn't configured (set MISTRAL_API_KEY).")
    body = {"model": settings.mistral_ocr_model, "document": _document(filename, data)}
    headers = {"Authorization": f"Bearer {settings.mistral_api_key}"}
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as c:
            r = await c.post(settings.mistral_ocr_url, json=body, headers=headers)
    except httpx.HTTPError as e:
        print(f"[ocr] request error: {e!r}", flush=True)
        raise OcrError("Could not reach the OCR service.") from e
    if r.status_code >= 400:
        print(f"[ocr] Mistral {r.status_code}: {r.text[:300]}", flush=True)
        raise OcrError("OCR failed on this document.")
    pages = r.json().get("pages", [])
    text = "\n".join(p.get("markdown", "") for p in pages).strip()
    if not text:
        raise OcrError("OCR produced no text from this document.")
    return text