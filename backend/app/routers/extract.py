"""Phase 2 API: parse an uploaded/pasted referral and extract the stated specialty.

The letter is read on the backend and discarded — only the small ExtractResult
returns to the browser. Nothing here submits, books, or ranks; it stops at the GP
confirm gate.
"""
from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.core.config import settings
from app.models.schemas import ExtractResult
from app.services import extraction, parsing

router = APIRouter(prefix="/api", tags=["extract"])


@router.post("/extract", response_model=ExtractResult)
async def extract(
    file: UploadFile | None = File(default=None),
    text: str | None = Form(default=None),
):
    raw_text = (text or "").strip()

    if file is not None and file.filename:
        data = await file.read()
        if len(data) > settings.max_upload_mb * 1024 * 1024:
            raise HTTPException(413, f"File too large (max {settings.max_upload_mb} MB).")
        try:
            raw_text = parsing.parse_referral(file.filename, data)
        except parsing.ParseError as e:
            raise HTTPException(422, str(e))

    if not raw_text:
        raise HTTPException(400, "Provide a referral: upload a file or paste text.")

    return await extraction.extract_specialty(raw_text)