"""Shared referral intake: turn an upload (or pasted text) into plain text, using
the local parsers with the hosted OCR fallback. Raises IntakeError (the caller maps
it to a 4xx). The letter is never persisted here.

Factored out so both /api/extract (Phase 2) and /api/flow (Phase 3) read referrals
the same way. /api/extract is left untouched for now and will move onto this in 3b.
"""
from fastapi import UploadFile

from app.core.config import settings
from app.services import ocr, parsing

_IMAGE_EXT = (".png", ".jpg", ".jpeg", ".webp", ".tiff", ".tif")


class IntakeError(Exception):
    def __init__(self, status: int, detail: str):
        self.status = status
        self.detail = detail


async def _ocr(filename: str, data: bytes) -> str:
    try:
        return await ocr.ocr_document(filename, data)
    except ocr.OcrError as e:
        raise IntakeError(422, str(e))


async def read_referral(file: UploadFile | None, text: str | None) -> str:
    raw = (text or "").strip()
    if file is not None and file.filename:
        data = await file.read()
        if len(data) > settings.max_upload_mb * 1024 * 1024:
            raise IntakeError(413, f"File too large (max {settings.max_upload_mb} MB).")
        name = file.filename.lower()
        if name.endswith(_IMAGE_EXT):
            if not ocr.enabled():
                raise IntakeError(422, "Image files need OCR — set MISTRAL_API_KEY, or upload a text-layer PDF/.docx.")
            raw = await _ocr(file.filename, data)
        else:
            try:
                raw = parsing.parse_referral(file.filename, data)
            except parsing.ParseError as e:
                if name.endswith(".pdf") and ocr.enabled():
                    raw = await _ocr(file.filename, data)
                else:
                    raise IntakeError(422, str(e))
    if not raw:
        raise IntakeError(400, "Provide a referral: upload a file or paste text.")
    return raw